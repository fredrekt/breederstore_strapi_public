export default {
  routes: [
    {
     method: 'POST',
     path: '/webhooks/stripe',
     handler: 'webhooks.stripeWebhook',
     config: {
       policies: [],
       middlewares: [],
     },
    },
    {
      method: 'POST',
      path: '/webhooks/stripe/connected',
      handler: 'webhooks.stripeWebhookConnectedAccounts',
      config: {
        policies: [],
        middlewares: [],
      },
     },
  ],
};
