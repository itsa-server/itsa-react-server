# itsa-react-server

Build high-performent and easy manageable SPAs based on React.js
MVC server for serverside rendered react apps.

You can use the **itsa-cli** to setup new web-applications. A full description, visit [http://itsaserver.io](http://itsaserver.io).

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
