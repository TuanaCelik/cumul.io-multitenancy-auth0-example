import {
  dashboardElement,
  dashboards,
  selectedDashboard,
  selectDashboard,
  namespace,
} from "./app.js";

// --------------------------------------------------------------- NAVIGATION & UI FUNCTIONS ---------------------------------------------------------------

class UI {
  constructor() {}

  initTabs(dashboardsToLoad) {
    let ul = document.querySelector("#tabs");
    for (const [slug, dashboard] of Object.entries(dashboardsToLoad)) {
      let li = document.createElement("li");
      li.id = "tabsList" + slug;
      li.classList.add("nav-item");
      let a = document.createElement("a");
      a.classList.add("nav-link");
      a.onclick = () => {
        selectDashboard(slug, li, dashboardElement);
      };
      // Set French dashboard name if existing, else set English name
      if (dashboardElement.language == "fr" && dashboard.name.fr) {
        a.innerText = dashboard.name.fr;
      } else a.innerText = dashboard.name.en;
      a.id = slug;
      li.append(a);
      ul.append(li);
    }
    selectedDashboard = Object.keys(dashboardsToLoad)[0];
  }

  hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  getUserProperty(user, property) {
    return user[namespace + property];
  }

  setUserDetails(user) {
    const t = this;
    const userLanguage = t.getUserProperty(user, "language");
    if (userLanguage) {
      document.querySelectorAll(".language-btn").forEach((el) => {
        if (el.textContent === userLanguage) {
          el.classList.add("active");
        } else {
          el.classList.remove("active");
        }
      });
      if (dashboardElement) dashboardElement.language = userLanguage;
    }
    // document.getElementById("back-button").innerHTML =
    //   userLanguage === "fr" ? "Retour" : "Back";
    document.getElementById("logoutButton").innerHTML =
      userLanguage === "fr" ? "Déconnecte" : "Log out";
    document.getElementById("welcomeText").innerHTML =
      userLanguage === "fr" ? "Bienvenue," : "Welcome back,";
    document.getElementById("user-name").textContent = t.getUserProperty(
      user,
      "firstName"
    );
    document.getElementById("user-image").onerror = function () {
      document.getElementById("user-image").src = "/images/favicon.ico";
    };
    document.getElementById("user-image").src =
      "/images/" + t.getUserProperty(user, "firstName").toLowerCase() + ".jpg";
    if (t.getUserProperty(user, "logoUrl"))
      document.getElementById("logo").src = t.getUserProperty(user, "logoUrl");

    dashboardElement.loaderSpinnerColor = t.getUserProperty(user, "base-color");
    document.querySelectorAll(".language-btn").forEach((el) => {
      el.style =
        "color: " + t.getUserProperty(user, "base-color") + "!important;";
    });

    var sheet = document.createElement("style");
    let rgb_color = t.hexToRgb(t.getUserProperty(user, "base-color"));
    sheet.innerHTML =
      "#sidebar{background: " +
      t.getUserProperty(user, "base-color") +
      " !important;} #back-button{background-color: rgba(" +
      rgb_color.r +
      ", " +
      rgb_color.g +
      ", " +
      rgb_color.b +
      ", 0.9)}  #back-button:hover,#back-button.active {  background-color: rgba(" +
      rgb_color.r +
      ", " +
      rgb_color.g +
      ", " +
      rgb_color.b +
      ", 0.4);}";
    document.body.appendChild(sheet);
  }

  async loadFirstPage() {
    selectDashboard(
      selectedDashboard,
      document.getElementById("tabsList" + selectedDashboard),
      dashboardElement
    );
  }

  toggleMenu(boolean) {
    if (boolean) {
      document.getElementById("sidebar").classList.add("open");
      document.getElementById("menuButton").classList.add("open");
      document.getElementById("menuButton").onclick = function () {
        toggleMenu(false);
      };
    } else {
      document.getElementById("sidebar").classList.remove("open");
      document.getElementById("menuButton").classList.remove("open");
      document.getElementById("menuButton").onclick = function () {
        toggleMenu(true);
      };
    }
  }

  changeUILanguage(language, elem) {
    if (elem.classList.contains("active")) return;
    document.querySelectorAll(".language-btn").forEach((el) => {
      el.classList.remove("active");
    });
    elem.classList.add("active");
    // Changes language of tabs to language selected
    document.querySelector("#tabs").childNodes.forEach((child, index) => {
      if (language == "fr" && dashboards[child.childNodes[0].id].name.fr) {
        child.childNodes[0].innerText =
          dashboards[child.childNodes[0].id].name.fr;
      } else
        child.childNodes[0].innerText =
          dashboards[child.childNodes[0].id].name.en;
    });

    document.getElementById("logoutButton").innerHTML =
      language === "fr" ? "Déconnecte" : "Log out";

    // Changes welcome text
    document.getElementById("welcomeText").innerHTML =
      language === "fr" ? "Bienvenue," : "Welcome back,";
  }
}

export { UI };
