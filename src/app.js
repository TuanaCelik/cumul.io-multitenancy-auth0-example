import { UI } from "./ui.js";

export const ui = new UI();
// dashboard configuration for integration

export const dashboardOptions = {
  dashboardId: "",
  container: "#dashboard-container",
  loader: {
    background: "#EEF3F6",
    spinnerColor: "#004CB7",
    spinnerBackground: "#DCDCDC",
    fontColor: "#000000",
  },
};

export let selectedDashboard;

export let dashboards = {};
let customEvents = {};

// --------------------------------------------------------------- AUTHENTICATION CONFIGURATION ---------------------------------------------------------------

// on page load
window.onload = async () => {
  await configureClient();
  const isAuthenticated = await auth0.isAuthenticated();

  // If is logged in -> init UI
  if (isAuthenticated) {
    return initUI();
  }

  const query = window.location.search;
  // If redirected from login
  if (query.includes("code=") && query.includes("state=")) {
    // Process the login state
    await auth0.handleRedirectCallback();
    // Set app state based on login
    initUI();
    // Use replaceState to redirect the user away and remove the querystring parameters
    window.history.replaceState({}, document.title, "/");
  }
  // If not logged in not redirected
  else {
    initUI();
  }
};

// Auth0 configuration
let auth0 = null;
export let namespace = "";
const fetchAuthConfig = () => fetch("/auth_config.json");
const configureClient = async () => {
  const response = await fetchAuthConfig();
  const config = await response.json();
  namespace = config.namespace;
  auth0 = await createAuth0Client({
    domain: config.domain,
    client_id: config.clientId,
    audience: config.audience,
  });
};

// login function
const login = async () => {
  await auth0.loginWithRedirect({
    redirect_uri: window.location.origin,
  });
};

// logout function
export const logout = () => {
  auth0.logout({
    returnTo: window.location.origin,
  });
};

// --------------------------------------------------------------- CUMUL.IO FUNCTIONS ---------------------------------------------------------------

// Function to retrieve the dashboard authorization token from the platform's backend
const getDashboardAuthorizationToken = async (dashboard_id, parameter) => {
  try {
    // Get the platform access credentials from the current logged in user
    const accessCredentials = await auth0.getTokenSilently();
    /*
      Make the call to the backend API, using the platform user access credentials in the header
      to retrieve a dashboard authorization token for this user
    */
    const response = await fetch(
      `/authorization?id=${dashboard_id}${
        parameter && Object.keys(parameter).length > 0
          ? "&params=" + parameter
          : ""
      }`,
      {
        headers: new Headers({
          Authorization: `Bearer ${accessCredentials}`,
        }),
      }
    );

    // Fetch the JSON result with the Cumul.io Authorization key & token
    const responseData = await response.json();
    return responseData;
  } catch (e) {
    // Display errors in the console
    console.error(e);
    return { error: "Could not retrieve dashboard authorization token." };
  }
};

// Function that selects and loads a dashboard on the page
export const selectDashboard = (selection_id, elem, parameter, container) => {
  // hide previous dashboard while loading
  if (elem && !dashboards[selection_id].isLoaded) {
    document.getElementById("dashboard-container").classList.add("invisible");
  }
  if (
    (!elem || !elem.classList.contains("active")) &&
    !dashboards[selection_id].isLoaded
  ) {
    getDashboardAuthorizationToken(dashboards[selection_id].id, parameter).then(
      (response) => {
        // Sets language that dashboard is loaded with, to see if dashboard should be reloaded if language changes
        dashboards[selection_id].key = response.key;
        dashboards[selection_id].token = response.token;
        if (!dashboards[selection_id].isDrillthrough) {
          Object.keys(dashboards).forEach((key) => {
            dashboards[key].isLoaded = false;
          });
          Cumulio.removeDashboard(container);
        }
        loadDashboard(
          dashboards[selection_id].id,
          response.key,
          response.token,
          container
        );
        if (container === "#drill-through-dashboard-container") {
          ui.showDrillThrough();
        }
        dashboards[selection_id].isLoaded = true;
      }
    );
  }
  // to hide all drill-through-containers if an item from sidebar is selected
  if (elem && !elem.classList.contains("active")) {
    ui.back();
    ui.hideDrillThrough(elem);
  }
};

// Add the dashboard to the page using Cumul.io embed
const loadDashboard = (dashboard_id, key, token, container) => {
  if (container) dashboardOptions.container = container;

  // use tokens if available
  if (key && token) {
    dashboardOptions.key = key;
    dashboardOptions.token = token;
  }
  dashboardOptions.dashboardId = dashboard_id;
  // Add the dashboard to the container element
  Cumulio.addDashboard(dashboardOptions);
};

Cumulio.onCustomEvent((e) => {
  // The custom events for drillthrough dashboards are added to the customEvents list when the app gets initialized.
  // Here you can write the implementation of which parameters should be initialized with which values.
  if (customEvents[e.data.event]) {
    let params = {};
    customEvents[e.data.event].required_parameters.forEach((param) => {
      /* ADAPT: THIS IS WHERE YOU SHOULD DECIDE WHICH VALUE HAS TO BE ASSIGNED TO WHICH PARAMETER */
      if (param.type === "hierarchy_array") {
        // params["< YOUR PARAMETER NAME HERE >"] = {value: ["< YOUR PARAMETER VALUE HERE >"]};
        if (param.name == "campaignName") {
          // which value from the event should be used depends on which item (e.g. bar chart, pie chart, table, etc.)
          // and which data (e.g. category, measure, columns, etc. ) is used.
          // In this example we've set a custom event on a bar chart and look for which category (i.e. y-axis) is selected.
          params[param.name] = { value: [e.data.category.id] };
        }
      } else if (param.type === "hierarchy")
        params["< YOUR PARAMETER NAME HERE >"] = {
          value: "< YOUR PARAMETER VALUE HERE >",
        };
      else if (param.type === "numeric_array")
        params["< YOUR PARAMETER NAME HERE >"] = {
          value: ["< YOUR PARAMETER VALUE HERE >"],
        };
      else if (param.type === "numeric")
        params["< YOUR PARAMETER NAME HERE >"] = {
          value: 0 /*< YOUR PARAMETER VALUE, WITHOUT QUOTATION MARKS >*/,
        };
      else if (param.type === "datetime")
        params["< YOUR PARAMETER NAME HERE >"] = {
          value: "YYYY-MM-DDTHH:MM:SS.xxxZ",
        };
      else
        console.log(
          "Parameter type of Custom Event " +
            e.data.event +
            " from dashboard " +
            e.dashboard +
            " is not recognized."
        );
    });
    if (
      Object.keys(params).length !=
      customEvents[e.data.event].required_parameters.length
    ) {
      console.log(
        "Required parameter of Custom Event " +
          e.data.event +
          " from dashboard " +
          e.dashboard +
          " have not been set."
      );
      return;
    }
    selectDashboard(
      customEvents[e.data.event].dashboardToSelect,
      null,
      JSON.stringify(params),
      "#drill-through-dashboard-container"
    );
  }

  // This is where you should add all custom events that are not related to drilling through to another dashboard
});

// When the dashboard is being initiated (message type 'init'), we will show the containers.
window.addEventListener("message", (e) => {
  if (e.data && e.data.type === "init")
    document
      .querySelectorAll("#dashboard-container")
      .forEach((el) => el.classList.remove("invisible"));
  document
    .querySelectorAll("#drill-through-dashboard-container")
    .forEach((el) => el.classList.remove("invisible"));
});

// Function to fetch tabs & dashboards from the backend
const fetchAndLoadDashboards = async () => {
  const accessCredentials = await auth0.getTokenSilently();
  let res = await fetch("/dashboards", {
    headers: new Headers({
      Authorization: `Bearer ${accessCredentials}`,
    }),
  });
  res = await res.json();
  dashboards = {};
  console.log("DASHBOARDS ENDPOINT : ", res);
  if (res && res.tabs) {
    ui.initTabs(res);
  }
  if (res && res.drill_throughs) {
    res.drill_throughs.forEach((drill_through) => {
      // add to list of possible dashboards
      dashboards[drill_through.name.en.toLowerCase().replaceAll(" ", "_")] = {
        id: drill_through.id,
        name: drill_through.name,
        isLoaded: false,
        isDrillthrough: true,
        key: "",
        token: "",
      };
      // add drillthrough custom events to the list
      Object.keys(drill_through.customEvents).forEach((customEvent) => {
        if (Object.keys(customEvents).includes(customEvent))
          console.log(
            "The following custom event is already defined: ",
            customEvent.eventName
          );
        else {
          customEvents[customEvent] = drill_through.customEvents[customEvent];
          customEvents[
            customEvent
          ].dashboardToSelect = drill_through.name.en
            .toLowerCase()
            .replaceAll(" ", "_");
        }
      });
    });
  }
};

// --------------------------------------------------------------- UI FUNCTIONS ---------------------------------------------------------------

// loads the user interface
const initUI = async () => {
  const isAuthenticated = await auth0.isAuthenticated();
  if (isAuthenticated) {
    const user = await auth0.getUser();
    ui.setUserDetails(user);
    await fetchAndLoadDashboards();
    document
      .getElementById("gated-content")
      .style.setProperty("display", "flex", "important");
    ui.loadFirstPage();
  } else {
    login();
  }
};

export function changeLanguage(language, elem) {
  ui.changeUILanguage(language, elem);
  dashboardOptions.language = language;
  // Changes language of loaded dashboards
  Object.keys(dashboards).forEach((key) => {
    if (dashboards[key].isLoaded && dashboards[key].isDrillthrough)
      loadDashboard(
        dashboards[key].id,
        dashboards[key].key,
        dashboards[key].token,
        "#drill-through-dashboard-container"
      );
    else if (dashboards[key].isLoaded)
      loadDashboard(
        dashboards[key].id,
        dashboards[key].key,
        dashboards[key].token,
        "#dashboard-container"
      );
  });
}
