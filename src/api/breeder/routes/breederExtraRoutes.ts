module.exports = {
  routes: [
    {
      method: "POST",
      path: "/breeder/stripe/setup-account",
      handler: "breeder.setupStripePayoutAccount",
      config: {
        policies: ["global::includeUserRelations"],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/breeder/verify/:id/:action",
      handler: "breeder.verifyBreeder",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
