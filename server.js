require("dotenv").load();
const express = require("express");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const { join } = require("path");

const app = express();

const authConfig = require("./auth_config.json");
const Cumulio = require("cumulio");

// Set this to false if you don't want custom theming on the dashboards
const custom_theme = true;
// This property is required when overriding themes, and will be used to set the widget backgrounds. By default, it is set to white.
const itemsBackground = "#ffffff";

// Set this to false if you don't want to use custom css. The current custom_css implementation will
const custom_css = true;
// Optionally, you can specify the image widget chart id where the logo should come. This is useful when you would have multiple image widgets in your dashboard.
const logo_widget_chart_id = "";
// Optionally, you can specify the text widget chart id where the user's first name should appear. This is useful when you would have multiple text widgets in your dashboard.
const text_widget_chart_id = "";

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${authConfig.domain}/.well-known/jwks.json`,
  }),

  audience: authConfig.audience,
  issuer: `https://${authConfig.domain}/`,
  algorithms: ["RS256"],
});

const client = new Cumulio({
  api_key: process.env.CUMULIO_API_KEY,
  api_token: process.env.CUMULIO_API_TOKEN,
});

// To authorize dashboards
app.get("/authorization", checkJwt, (req, res) => {
  if (!req.query) return res.status(400).json("Not a valid request.");

  let options = {
    type: "sso",
    expiry: "1 day",
    inactivity_interval: "30 minutes",
    username: req.user[authConfig.namespace + "firstName"],
    name: req.user[authConfig.namespace + "firstName"],
    email: req.user[authConfig.namespace + "email"],
    integration_id: "a11b22e0-31bb-4bc2-908a-7426545cb14c",
    suborganization:
      req.user[authConfig.namespace + "parameters"]["companyName"][0],
    role: req.user[authConfig.namespace + "role"],
    metadata: {},
  };

  Object.keys(getUserProperty(req.user, "parameters")).forEach((key) => {
    options.metadata[key] = getUserProperty(req.user, "parameters")[key];
  });

  // Adds additional parameters that were added in the url by the frontend
  if (req.query.params) {
    let params = JSON.parse(req.query.params);
    Object.keys(params).forEach((paramName) => {
      options.metadata[paramName] = params[paramName].value;
    });
  }

  // if (custom_css) {
  //   // Override some css (in this case: change image on dashboard to company logo)
  //   options.css =
  //     logo_widget_chart_id.length > 0 ? "#w" + logo_widget_chart_id : "";
  //   options.css += getUserProperty(req.user, "logoUrl")
  //     ? '.image-inner-wrapper{background-image: url("' +
  //       getUserProperty(req.user, "logoUrl") +
  //       '") !important;}'
  //     : "";
  //   options.css +=
  //     text_widget_chart_id.length > 0 ? "#w" + text_widget_chart_id : "";
  //   options.css +=
  //     ".editor-container.ql-editor:nth-child(1):before {content: '" +
  //     getUserProperty(req.user, "firstName") +
  //     ",' !important; font-size: 16px; color: " +
  //     getUserProperty(req.user, "base-color") +
  //     "; font-weight: 800;}";
  // }

  // if (
  //   custom_theme &&
  //   getUserProperty(req.user, "base-color") &&
  //   getUserProperty(req.user, "colors")
  // ) {
  //   // Override theme (in this case: change main color and theme colors)
  //   let theme = {
  //     itemsBackground: itemsBackground,
  //     type: "custom",
  //   };
  //   theme.mainColor = getUserProperty(req.user, "base-color");
  //   theme.colors = getUserProperty(req.user, "colors");

  //   options.theme = theme;
  // }

  return client
    .create("authorization", options)
    .then((result) => {
      return res.status(200).json({ key: result.id, token: result.token });
    })
    .catch((error) => {
      console.log("ERROR: ", JSON.stringify(error));
    });
});

function getUserProperty(user, property) {
  return user[authConfig.namespace + property];
}

// Serve static assets from the /public folder
app.use(express.static(join(__dirname, "public")));

// Endpoint to serve the configuration file
app.get("/auth_config.json", (req, res) => {
  res.sendFile(join(__dirname, "auth_config.json"));
});

app.use(function (err, req, res, next) {
  if (err) console.log(err);
  if (err.name === "UnauthorizedError") {
    return res.status(401).send({ msg: "Invalid token" });
  }
  next(err, req, res);
});

// Serve the index page for all other requests
app.get("/*", (req, res) => {
  res.sendFile(join(__dirname, "public/index.html"));
});

// Listen on port 3000 & get dashboards w tags
app.listen(3000, () => {
  console.log("Application running on port 3000");
});
