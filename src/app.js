import { UI } from "./ui.js";
import "@cumul.io/cumulio-dashboard";

export const ui = new UI();
export const dashboardElement = document.getElementById("dashboard");
export const drillThroughDashboardElement = document.getElementById(
  "drill-through-dashboard-container"
);

export let selectedDashboard;

export let dashboards = {};

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
const getDashboardAuthorizationToken = async () => {
  try {
    // Get the platform access credentials from the current logged in user
    const accessCredentials = await auth0.getTokenSilently();
    /*
      Make the call to the backend API, using the platform user access credentials in the header
      to retrieve a dashboard authorization token for this user
    */
    const response = await fetch("/authorization", {
      headers: new Headers({
        Authorization: `Bearer ${accessCredentials}`,
      }),
    });

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
export const selectDashboard = (selection_id, elem, container) => {
  if (dashboards[selection_id].isLoaded) {
    return;
  }
  getDashboardAuthorizationToken(dashboards[selection_id].id).then(
    (response) => {
      for (const [slug, dashboard] of Object.entries(dashboards)) {
        dashboard.isLoaded = false;
        document.getElementById("tabsList" + slug).classList.remove("active");
      }
      dashboards[selection_id].key = response.key;
      dashboards[selection_id].token = response.token;

      loadDashboard(dashboards[selection_id].id, response.key, response.token);

      document.querySelectorAll("#tabs").forEach((el) => {
        el.classList.remove("active");
      });
      elem.classList.add("active");
      dashboards[selection_id].isLoaded = true;
    }
  );
};

// Add the dashboard to the page using Cumul.io embed
const loadDashboard = (dashboard_id, key, token) => {
  if (key && token) {
    dashboardElement.authKey = key;
    dashboardElement.authToken = token;
  }
  dashboardElement.dashboardId = dashboard_id;
};

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
  const auth = await getDashboardAuthorizationToken();
  if (auth.key && auth.token) {
    dashboardElement.authToken = auth.token;
    dashboardElement.authKey = auth.key;
    let accessibleDashboards = await dashboardElement.getAccessibleDashboards();
    accessibleDashboards.forEach((dashboard) => {
      dashboards[dashboard.slug] = {
        id: dashboard.id,
        name: dashboard.name,
        key: "",
        token: "",
        isLoaded: false,
      };
    });

    ui.initTabs(dashboards);
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
  dashboardElement.language = language;
  // Changes language of loaded dashboards
  Object.keys(dashboards).forEach((key) => {
    if (dashboards[key].isLoaded && dashboards[key].isDrillthrough)
      loadDashboard(
        dashboards[key].id,
        dashboards[key].key,
        dashboards[key].token
      );
    else if (dashboards[key].isLoaded)
      loadDashboard(
        dashboards[key].id,
        dashboards[key].key,
        dashboards[key].token
      );
  });
}
