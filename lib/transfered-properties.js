/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

const React = require('react');

//TEXTObjectStringToDates looks pretty ugly, but we need it in text-form
// it is the js-uglyfied version of the module object-string-to-date.js
const TEXTObjectStringToDates = '!function(){"use strict";var t,n,r,e,o,c,i;i=/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,t={undefined:!0,number:!0,"boolean":!0,string:!0,"[object Function]":!0,"[object RegExp]":!0,"[object Array]":!0,"[object Date]":!0,"[object Error]":!0,"[object Blob]":!0,"[object Promise]":!0},c=function(t){return i.test(t)?new Date(t):null},n=function(n){return!(t[typeof n]||t[{}.toString.call(n)]||!n||window.Promise&&n instanceof window.Promise)},r=function(t,n){for(var r,e=Object.keys(t),o=e.length,c=-1;++c<o;)r=e[c],n.call(t,t[r],r,t)},e=function(t){var i;r(t,function(r,a){"string"==typeof r?(i=c(r))&&(t[a]=i):n(r)?e(r):Array.isArray(r)&&o(r)})},o=function(t){var r;t.forEach(function(i,a){"string"==typeof i?(r=c(i))&&(t[a]=r):n(i)?e(i):Array.isArray(i)&&o(i)})},Object.stringToDates=function(t){return e(t),t}}();';

class TransferedProperties extends React.Component {
    render() {
        const props = this.props,
        // create the client-props:
            scriptContent = {
                __html: TEXTObjectStringToDates+
                    'window.__itsa_react_server||(window.__itsa_react_server={});'+
                    'try {'+ // NOTE: eval must start with 0?0: for IE9 compatibility --> see http://stackoverflow.com/questions/6807649/problems-with-ie9-javascript-eval
                        'window.__itsa_react_server.props=Object.stringToDates(eval(0?0:'+JSON.stringify(props.clientProps)+'))'+
                    '}'+
                    'catch(e) {'+
                        'console.warn(\'eval-error2:\',e);window.__itsa_react_server.props={}'+
                    '}'
            };
        return (
            <script dangerouslySetInnerHTML={scriptContent} />
        );
    }
}

module.exports = TransferedProperties;
