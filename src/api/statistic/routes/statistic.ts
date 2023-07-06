export default {
  routes: [
    {
     method: 'GET',
     path: '/statistic',
     handler: 'statistic.getStats',
     config: {
       policies: ["global::includeUserRelations"],
       middlewares: [],
     },
    },
  ],
};
