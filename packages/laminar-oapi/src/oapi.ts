import { compile, validate, validateCompiled, Schema } from '@ovotech/json-schema';
import {
  Context,
  Resolver,
  Route,
  RouteContext,
  selectRoute,
  toRoute,
  Middleware,
  message,
  toResponse,
  ContextLike,
} from '@ovotech/laminar';
import { openapiV3 } from 'openapi-schemas';
import { OpenAPIObject, SecurityRequirementObject, SecuritySchemeObject } from 'openapi3-ts';
import { OperationSchema, PathsSchema, toSchema } from './oapi-to-schema';
import { OapiResolverError } from './OapiResolverError';
import { ResolvedOpenAPIObject } from './resolved-openapi-object';

export interface OapiContext extends RouteContext {
  authInfo?: OapiAuthInfo;
}

export interface OapiAuthInfo {
  [key: string]: unknown;
}

export interface OapiRoute<C extends ContextLike = ContextLike> extends Route<C> {
  schema: OperationSchema;
}

export interface OapiPaths<C extends ContextLike = ContextLike> {
  [path: string]: { [method: string]: Resolver<C & OapiContext & Context> };
}

export interface OapiConfig<C extends ContextLike = ContextLike> {
  api: OpenAPIObject | string;
  paths: OapiPaths<C>;
  security?: OapiSecurity<C>;
  bodyParser?: Middleware<ContextLike, Context>;
}

export type OapiSecurityResolver<C extends ContextLike = ContextLike> = (
  context: C & Context & OapiContext,
  options: {
    scheme: SecuritySchemeObject;
    scopes: string[];
  },
) => OapiAuthInfo | void | Promise<OapiAuthInfo | void>;

export interface OapiSecurity<C extends ContextLike = ContextLike> {
  [key: string]: OapiSecurityResolver<C>;
}

const toRoutes = <C extends ContextLike = ContextLike>(
  pathsSchema: PathsSchema,
  paths: {
    [path: string]: { [method: string]: Resolver<C & OapiContext> };
  },
): OapiRoute<C>[] =>
  Object.entries(paths).reduce<OapiRoute<C>[]>(
    (allPaths, [path, methods]) =>
      Object.entries(methods).reduce(
        (all, [method, resolver]) => [
          ...all,
          {
            ...toRoute<C & OapiContext>(method, path, resolver),
            schema: pathsSchema[path][method],
          },
        ],
        allPaths,
      ),
    [],
  );

export const isAuthInfo = (item: unknown): item is OapiAuthInfo =>
  typeof item == 'object' && item !== null;

export const isResolvedOpenAPIObject = (schema: unknown): schema is ResolvedOpenAPIObject =>
  typeof schema === 'object' &&
  schema !== null &&
  'openapi' in schema &&
  'info' in schema &&
  'paths' in schema;

const validateSecurity = async <C extends ContextLike = ContextLike>(
  context: C & Context & OapiContext,
  requirements?: SecurityRequirementObject[],
  schemes?: { [securityScheme: string]: SecuritySchemeObject },
  security?: OapiSecurity<C>,
): Promise<unknown> => {
  if (!requirements || requirements.length === 0 || !security || !schemes) {
    return undefined;
  }

  const checks = requirements
    .map(async (requirement) => {
      const securityContexts = Object.entries(requirement)
        .map(([name, scopes]) => security[name](context, { scheme: schemes[name], scopes }))
        .filter(isAuthInfo);
      return (await Promise.all(securityContexts)).reduce((a, b) => ({ ...a, ...b }), {});
    })
    .map((check) => check.catch((error) => error));

  const results = await Promise.all(checks);
  const authInfo = results.find((result) => !(result instanceof Error));

  if (!authInfo) {
    throw results.find((result) => result instanceof Error);
  }

  return authInfo;
};

export const createOapi = async <C extends ContextLike = ContextLike>({
  api,
  paths,
  security,
}: OapiConfig<C>): Promise<Resolver<C & Context>> => {
  const { schema, ...schemaOptions } = await compile(api);

  const checkApi = await validate({ schema: openapiV3 as Schema, value: schema });
  if (!checkApi.valid) {
    throw new OapiResolverError('Invalid API Definition', checkApi.errors);
  }

  if (!isResolvedOpenAPIObject(schema)) {
    throw new OapiResolverError('Error validating schema');
  }

  const schemas = toSchema(schema);
  const routes = toRoutes(schemas.routes, paths);

  const checkResolvers = validateCompiled({
    schema: { ...schemaOptions, schema: schemas.resolvers },
    name: 'api',
    value: { paths, security },
  });

  if (!checkResolvers.valid) {
    throw new OapiResolverError('Invalid Resolvers', checkResolvers.errors);
  }

  return async (ctx) => {
    const select = selectRoute<ContextLike, C, OapiRoute<C & Context>>(ctx, routes);

    if (!select) {
      return message(404, {
        message: `Path ${ctx.method} ${ctx.url.pathname} not found`,
      });
    }

    const {
      route: { resolver, schema: routeSchema },
      path,
    } = select;

    const context: C & Context & OapiContext = { ...ctx, path };

    const checkContext = validateCompiled({
      schema: { ...schemaOptions, schema: routeSchema.context },
      name: 'context',
      value: context,
    });

    if (!checkContext.valid) {
      return message(400, {
        message: `Request Validation Error`,
        errors: checkContext.errors,
      });
    }

    const authInfo = await validateSecurity<C>(
      context,
      routeSchema.security,
      schema.components?.securitySchemes,
      security,
    );

    const laminarResponse = toResponse(await resolver({ ...context, authInfo }));
    const checkResponse = validateCompiled({
      schema: { ...schemaOptions, schema: routeSchema.response },
      value: laminarResponse,
      name: 'response',
    });

    if (!checkResponse.valid) {
      return message(500, {
        message: `Response Validation Error`,
        errors: checkResponse.errors,
      });
    }

    return laminarResponse;
  };
};
