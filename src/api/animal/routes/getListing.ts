module.exports = {
  routes: [
    {
      method: "GET",
      path: "/animals/listing/:id",
      handler: "animal.getListing",
      config: {
        policies: ["global::includeUserRelations"],
        middlewares: [],
      },
    },
  ],
};
