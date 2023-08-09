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
  ],
};
