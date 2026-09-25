# itsa-react-server

Build high-performent and easy manageable SPAs based on React.js
MVC server for serverside rendered react apps.

You can use the **itsa-cli** to setup new web-applications. A full description, visit [http://itsaserver.io](http://itsaserver.io).

## Upgrading to 18.0.0

Version 18 moves from hapi 16 to **hapi 21** and from React 15 to **React 16**. It is a breaking
release: every app built on itsa-react-server needs code changes. The full guide with before/after
examples is [MIGRATION-18.md](MIGRATION-18.md); this is the checklist.

**What your app needs**

1. **Node.js 14 or later** (tested on Node 24).
2. **Dependencies:** remove `hapi`; install `@hapi/hapi@^21`, `itsa-react-server@^18`,
   `react@^16.14.0` and `react-dom@^16.14.0`. Replace `boom`/`hoek`/`inert`/`vision` with their
   `@hapi/*` packages if your app uses them directly.
3. **`src/manifest.json`:** replace `react/dist/...` and `react-dom/dist/...` paths in
   `external-modules` with the React 16 `umd/` files (table in the guide).
4. **`server.js`:** create the server with
   `Hapi.server(Object.assign(reactServer.getServerOptions(manifest), {...your options}))`, then
   `await server.register({plugin: reactServer, options: manifest})` and `await server.start()`.
   No `server.connection()`, no callbacks.
5. **Routes (`src/routes.js`):** every handler **returns** — `handler: (request, h) => h.reactview('index')`.
   A handler without `return` answers 500.
6. **`reply` becomes `h` everywhere:** route handlers, actions (`src/actions`), models
   (`src/models`, `src/model-general.js`, `src/initial-globalstate.js`) and the authentication
   `validateFunc`. `reply.reactview/action/assets/login/logout/generateProps/setBodyDataAttr`
   become the same methods on `h`; `reply.request` becomes `h.request`.
7. **Actions return their response:** `reply(stream).header(...)` becomes
   `return h.response(stream).header(...)`; a returned value is sent as before.
8. **React 15 → 16 component changes:** `React.PropTypes` and `React.createClass` are gone.
9. **Check the behaviour changes:** cookies are sent with `SameSite=Lax`; `request.url` is a
   WHATWG `URL` (use `pathname`/`search`); multipart uploads parsed by hapi need
   `payload: {multipart: true}`; an empty response answers 204 instead of 200; `.js` assets are
   served as `text/javascript`; a failing plugin start now makes `server.register()` reject.

**Security fix — upgrade soon.** Up to 17.x, an asset URL with an encoded `../`
(for example `/assets/..%2F..%2F..%2F..%2F.cookierc`) can read any file of the app, including the
cookie passwords in `.cookierc`. 18.0.0 confines every asset route to its own directory.

## Installation

Step 1: install itsa-cli globally:

```
npm install -g itsa-cli
```

## Creating applications

Once you have all these packages, you can create a new web-application like this:

### Create a new application:

```js
itsa create appname
```

`appname` will become a new folder with all appropriate files.

### Check the new application

Goto the created folder and run:

```js
npm run start
```

As soon as the message **Server running development at port: 3001** appears, you can open a browser and visit **http://localhost:3001**. The `Hello World!` app should come up.

See http://itsaserver.io for the complete documentation and usage.

### Using .scss files (since 17.0.0)

Sass is compiled by [Dart Sass](https://sass-lang.com/dart-sass) (`sass`) instead of `node-sass`, which does not support Node.js 24. Every app that uses `.scss` adds `options: { implementation: require('sass') }` to its `sass-loader` rule:

```js
{
    test: /\.scss$/,
    use: [
        // ...your other loaders
        {
            loader: 'sass-loader',
            options: { implementation: require('sass') }
        }
    ]
}
```


--------------

You can start right away building your application. Any help can be found at [http://itsaserver.io](http://itsaserver.io).

#### If you want to express your appreciation

Feel free to donate to one of these addresses; my thanks will be great :)

* Ether: 0xE096EBC2D19eaE7dA8745AA5D71d4830Ef3DF963
* Bitcoin: 37GgB6MrvuxyqkQnGjwxcn7vkcdont1Vmg
