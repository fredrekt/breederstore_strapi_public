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
    ],
  };
  