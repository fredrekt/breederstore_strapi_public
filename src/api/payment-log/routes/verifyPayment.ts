module.exports = {
    routes: [
      {
        method: "POST",
        path: "/payment-log/verify",
        handler: "payment-log.verifyPayment",
        config: {
          policies: [],
          middlewares: [],
        },
      },
    ],
  };
  