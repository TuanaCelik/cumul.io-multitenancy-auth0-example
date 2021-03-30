# Multi-tenant integration example with use of Auth0

Follow the steps below to setup a simple webapp that displays a [Cumul.io](https://cumul.io) dashboard with multi tenancy. Setting this app will allow you to define rules that determine what each user has access to on your dashboard.

Before you begin, you will need a [Cumul.io](https://cumul.io) account.

## I. Create a dashboard

You can create as many dashboards as you'd like, with custom events and parameters (in the case of drillthrough, the custom event of the current dashboard should be able to use value(s) for parameter(s) in the drillthrough dashboard).

How the dashboard setup should look like:

- regular dashboards (i.e. tabs in the sidebar):

  - Need to have a tag (currently: `auth0-mt`) assigned to them that will be used to fetch these dashboards when the backend server is launched.
  - Can have Custom Events: I've implemented a drill-through container that slides in and out (there is currently only a single drill-through container).

- drill-through dashboards:

  - Need to have a tag (currently: `auth0-mt-dt`) assigned to them that will be used to fetch these dashboards when the backend server is launched.
  - Requires the following additional tags:

    - _customEventTag_: is prepended with `ce-`, and will be used to know the custom_event_name that should drill through to this dashboard. The same applies as with the parameter_type: the custom_event_name **CANNOT** contain a **"-"**. Also keep in mind that the custom_event_name should be unique for this application to work, i.e. you can't specify the same custom event tag on a different dashboard (you can use the same custom_event name in different dashboards to point towards the same drillthrough dashboard).

      Structure: **ce-**`<your_custom_event_name_triggering_this_drillthrough_dashboard>`

      E.g. `ce-select_campaign`

    - _parameterTag_: is prepended with `p-`, and will be used to know which custom event uses which parameter (name and type). If no parameters are needed for the custom event, you don't have to set this tag on the drillthrough dashboard. All individual elements (eg parameter_type) **CANNOT** contain a **"-"** as this will be used to split the tag.
      parameter_types supported: hierarchy_array, hierarchy, numeric_array, numeric and datetime.

          Structure: **p-**`<your_custom_event_name_triggering_this_drillthrough_dashboard>`**-**`<parameter_type>`**-**`<parameter_name>`

          E.g. `p-select_campaign-hierarchy_array-campaignName`

## II. Auth0 setup

1.  Create an account [here](https://auth0.com/)

2.  In the Applications menu create a new Application and select Single Page Web Applications and in Settings:

    - copy 'Domain' & 'Client ID' to the same attributes in the `auth_config.json` file

    - set the parameters of:
      > Allowed Callback URLs: `http://localhost:3000`
      > Allowed Logout URLs: `http://localhost:3000`
      > Allowed Web Origins: `http://localhost:3000`
    - Save the changes

    in Connections: deactivate google-oauth2 (to hide social)

3.  In Applications -> APIs copy 'API audience' next to Auth0 Management API to the audience attribute in the `auth_config.json` file

4.  Add some users in User Management -> Users:

    - Go to users & create a user

    - You should add the following properties to the `user_metadata` of a user:

      - `firstName`: will be used to display name in application
      - `language`: will be used to initially show application is language set, currently only "fr" and "en" are supported.
      - `base-color`: will be used to style the sidebar and to use in the dashboards (should be in hex!)
      - `colors`: will be used in the dashboard (should be in hex!)
      - `logoUrl`: will be used in the dashboard (optional: if not specified, it will not be used). Keep in mind that it will replace all image widgets' internal images: in case you want to override a specific image, specify the variable `logo_widget_chart_id` in the `server.js` file.

      An example of the `user_metadata`:

      ```json
      {
        "firstName": "Brad",
        "language": "en",
        "base-color": "#ff784f",
        "colors": [
          "#880065",
          "#b3005e",
          "#b3005e",
          "#ef513e",
          "#fd7b27",
          "#ffa600",
          "#fdae6b"
        ],
        "logoUrl": "https://cumul.io/assets/favicon/logo.svg"
      }
      ```

    - You should add the following properties to the `app_metadata` of a user:
      _ `parameters`: object containing parameter names and their values. These parameter filters will **ALWAYS** be applied in the authorization token, so e.g. useful for row-level security per client.
      _ `scope`: object containing the dashboard names that the user is allowed access to. You can optionally use `scope":{"*"}` to give access to all dashboards.
      **\*The English dashboard title** will be used to assign clients access to a dashboard (they will also be used as tab titles in the sidebar)! The title should be lowercased, and all spaces `" "` in the title should be replaced with `"_"` when you specify them here.\*

          An example of the `app_metadata`:

          ```json
          {
              "parameters": {
                  "<parameter name>": ["<parameter value 1>", "<parameter value 2>"]
              },
              "scope": {
                  "dashboards": [
                      "lowercased_english_dashboard_name_1",
                      "lowercased_english_dashboard_name_2";
                      "lowercased_english_drillthrough_dashboard_name_1"
                  ]
              }
          }
          ```

      (`user_metadata` is meant for user preferences that they could easily change, whereas `app_metadata` is for user information that an admin would control)

5.  In order for the metadata to be able to be extracted from the jwt tokens we need to add a rule.

    - Go to Auth Pipeline -> Rules and create a rule with name 'Add metadata to token' and use the following function:

      ```javascript
      let namespace = "http://namespace.app/";
      function (user, context, callback) {
      user.user_metadata = user.user_metadata || {};
      Object.keys(user.user_metadata).forEach((k) => {
        context.idToken[namespace + k] = user.user_metadata[k];
        context.accessToken[namespace + k] = user.user_metadata[k];
      });
      Object.keys(user.app_metadata).forEach((k) => {
        context.idToken[namespace + k] = user.app_metadata[k];
        context.accessToken[namespace + k] = user.app_metadata[k];
      });
      callback(null, user, context);
      }
      ```

    - copy the namespace value used in the rule function above to the namespace property in the `auth_config.json` file. The namespace is required for Auth0 as an arbitrary identifier (see [here](https://auth0.com/docs/tokens/create-namespaced-custom-claims)).

## III. App install

`npm install`

Create a file called `.env` in the root directory with two keys. Replace the `CUMULIO_API_KEY` & `CUMULIO_API_TOKEN` with one from your Cumul.io account. You can create one in your Profile settings under API Tokens:

```
CUMULIO_API_KEY=XXX
CUMULIO_API_TOKEN=XXX
```

## IV. Adapt `server.js` according to your needs

- If you have chosen different tags to tag regular and drillthrough dashboards, you will need to change the consts `tag` and `drillthroughtag`.
- Optionally, you can disable custom theming and/or custom css, by setting the consts `custom_theme` and `custom_css` to false. You can also specify a specific image and/or text widget chart id where the logo and first name of the client should appear, otherwise it will add it to all image and text widgets.

## V. Adapt `public/js/app.js` according to your needs

- If you want, you can change the styling of the loader on top.
- You will have to add your desired functionality of your custom event(s) under `Cumulio.onCustomEvent((e)=>{...}`. This is where you can assign the selected values to the corresponding parameters.

## VI. Run the app

1. `npm run start` or if you do not have nodemon, use: `node server.js`
2. each time you add/remove dashboards, or change something to `server.js` you will have to restart the server. Changes to e.g. `public/js/app.js` do not require a server restart, but could be cached on the client side so it could be that you have to hard-refresh your browser in order to see the changes.

## VII. Recap

- If you want to use client-specific parameters, add them to:
  1. the dashboard
  2. the auth0 user
- If you want to use drillthrough, you have to do the following steps:
  1. Create the drill-through dashboard, and set the right tags on it so the application can find it (specified in step 1).
  2. Assign the dashboard to the user in auth0 (using the name of the dashboard, as explained in Step 2.4).
  3. Add the code in `src/app.js` to fill in the drillthrough parameters with the values selected in the chart. If no parameters should be filled in, the drillthrough functionality works natively without making any code change!
- If you use other first names, adapt the images in public/images or use the gravatar link from the user in the index.html
