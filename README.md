# itsa-react-server

Build high-performent and easy manageable SPAs based on React.js
MVC server for serverside rendered react apps.

You can use the **itsa-cli** to setup new web-applications. A full description, visit [http://itsaserver.io](http://itsaserver.io).

## Changes in 17.1.0

**This release is breaking for apps still on React 15** (a `^17.0.0` range without a lockfile picks
it up automatically).

- itsa-react-server renders with React 16 (was 15): apps need `react` and `react-dom` ^16. The
  rendered markup is unchanged for the tested pages; React 16 writes `style` attributes without the
  trailing `;` and keeps unknown attributes that React 15 dropped (harmless for browsers). The
  default manifest's external modules point at React 16's `umd/` files. Apps whose own
  `src/manifest.json` lists `external-modules` (top level or under `environments`) must change
  React's `dist/` files to `react/umd/react.production.min.js`,
  `react-dom/umd/react-dom.production.min.js` and
  `react-dom/umd/react-dom-server.browser.production.min.js` (the matching `.development.js` files
  for `local` and `development`): the app's array replaces the default one, and the build only
  prints a warning when a file is missing, so the client would ship without React.
- React 16 removed `React.PropTypes`, `React.createClass` and `React.DOM`; use `prop-types`,
  `create-react-class` and `react-dom-factories`.
- Fixed a memory leak on every page render (2-6 KB per page). A long-running worker ended with
  `FATAL ERROR ... out of memory`; in PM2 cluster mode that message only shows up in
  `~/.pm2/pm2.log`, not in the app's own error log.
- Fixed a memory leak in the socket server: websocket compression is off and socket.io is 2.5
  (browsers get socket.io-client 2.5.0 after the next build, and a vanished client is dropped after
  45 s instead of 30 s). A client message may still be 100 MB; set `socketServer.maxHttpBufferSize`
  (bytes) in the manifest to lower it. Each worker buffers a whole client message up to that size;
  `0` or an empty value falls back to 100 MB.
- Fixed: on Node.js 16 and later, requests with a payload (POST, PUT, ...) got no response (a hapi 16
  issue, worked around by this package).
- Fixed: on Node.js 12 and later, pages logged an error for every missing `@phone`/`@tablet` model.
- Fixed: a malformed socket message could crash the process.
- Note: in PM2 cluster mode the workers run on the Node.js version of the PM2 daemon. After switching
  Node.js (for example with nvm), run `pm2 update`.

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
