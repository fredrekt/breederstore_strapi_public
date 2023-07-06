/**
 * includeUserRelations policy
 */

export default async (policyContext, config, { strapi }) => {
  strapi.log.info("Include user relations.");

  if (!policyContext.state.user.isBuyer) {
    strapi.log.info("user context added breeder: id if user is a breeder.");
    const { breeder } = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      policyContext.state.user.id,
      {
        fields: ["id"],
        populate: { breeder: true },
      }
    );
    policyContext.state.user.breederId = breeder.id;
    if (!breeder.id) return false;
    return true;
  }
  return false;
};
