const DashboardClient = class {
  constructor() {
    this.tag = "auth0-mt";
    this.drillthroughtag = "auth0-mt-dt";
    this.dashboards = { tabs: [], drill_throughs: [] };
  }

  async getDashboards(client) {
    const allDashboards = await this.getAllDashboards(client);

    if (this.dashboards.tabs.length > 0 && allDashboards.rows.length <= 0)
      return;
    if (this.dashboards.drill_throughs.length > 0) return;

    await this.groupDashboards(allDashboards.rows);

    console.log(
      "Successfully fetched " +
        this.dashboards.tabs.length.toString() +
        " dashboard tab(s). and " +
        this.dashboards.drill_throughs.length.toString() +
        " drill-through(s)."
    );
  }

  getAllDashboards(client) {
    return client.get("securable", {
      where: {
        type: "dashboard",
      },
      options: {
        public: false,
      },
      attributes: ["id", "name"],
      search: {
        match_types: ["tag"],
        keyphrase: "auth0-mt",
      },
      include: [
        {
          model: "Tag",
          attributes: ["tag"],
        },
      ],
    });
  }

  groupDashboards(allDashboards) {
    allDashboards.forEach(async (dashboard) => {
      const tags = await dashboard.tags.map((entry) => {
        return entry.tag;
      });

      if (!tags.includes(this.drillthroughtag)) {
        this.dashboards.tabs.push({ id: dashboard.id, name: dashboard.name });
      } else {
        this.getExtraTags(dashboard);
      }
    });
  }

  // other drill-through dashboard tags expected:
  // * parameterTag: is prepended with "p-", and will be used to know which custom event uses the parameter_type and parameter_name.
  //              	All individual elements (eg parameter_type) CANNOT contain a "-" as this will be used to split the tag.
  //					parameter_types_supported: hierarchy_array, hierarchy, numeric_array, numeric and datetime.
  // 	 p-<your_custom_event_name_triggering_this_drillthrough_dashboard>-<parameter_type>-<parameter_name>
  //
  // * customEventTag: is prepended with "ce-", and will be used to know the custom_event_name that should drill through to this dashboard.
  //					  As mentioned above, keep in mind that the custom_event_name CANNOT contain a "-".
  //	 ce-<your_custom_event_name_triggering_this_drillthrough_dashboard>
  getExtraTags(dashboard) {
    let extraTags = dashboard.tags.filter(
      (row) => row.tag != this.tag && row.tag != this.drillthroughtag
    );
    let drill_through = {
      id: dashboard.id,
      name: dashboard.name,
      customEvents: {},
      parameters: [],
      eventName: "",
    };
    let ceTags = extraTags.filter((tag) => tag.tag.startsWith("ce-"));
    let pTags = extraTags.filter((tag) => tag.tag.startsWith("p-"));
    let unrecognizedTags = extraTags.filter(
      (tag) => !tag.tag.startsWith("ce-") && !tag.tag.startsWith("p-")
    );
    ceTags.forEach((tag) => {
      drill_through.customEvents[tag.tag.slice(3)] = {
        required_parameters: [],
      };
      drill_through.eventName = tag.tag.slice(3);
    });
    pTags.forEach((tag) => {
      let customEventName = tag.tag.slice(2, 2 + tag.tag.slice(2).indexOf("-"));
      let parameterType = tag.tag.slice(
        3 + customEventName.length,
        3 +
          customEventName.length +
          tag.tag.slice(3 + customEventName.length).indexOf("-")
      );
      let parameterName = tag.tag.slice(
        4 + customEventName.length + parameterType.length
      );
      drill_through.customEvents[customEventName].required_parameters.push({
        name: parameterName,
        type: parameterType,
      });
      drill_through.parameters.push(parameterName);
    });
    unrecognizedTags.forEach((tag) => {
      console.log("Tag " + tag.tag + " is not recognized and will be ignored.");
    });
    this.dashboards.drill_throughs.push(drill_through);
  }
};

module.exports = DashboardClient;
