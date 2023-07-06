module.exports = () => {
  return async (ctx, next) => {
    await next();
    // only if path was register with newsletter param and it was successfull. Then we will put user in the mailing list.
    if (
      ctx.request.url === "/api/auth/local/register?breeder=true" &&
      ctx.response.status === 200
    ) {
      const userId = ctx.response.body.user.id;
      const registryName = ctx.request.body.registryName;
      const prefix = ctx.request.body.prefix;

      const createBreeder = await strapi.db
        .query("api::breeder.breeder")
        .create({
          data: {
            businessName: registryName,
            prefix: prefix,
            user: userId,
            publishedAt: new Date().toISOString(),
          },
        });

      if (createBreeder) {
        const updateQuery = {
          where: {
            id: userId,
          },
          data: {
            publishedAt: new Date().toISOString(),
            breeder: createBreeder.id
          },
        };
        await strapi.db.query("plugin::users-permissions.user").update(updateQuery);
      }
    }
  };
};
