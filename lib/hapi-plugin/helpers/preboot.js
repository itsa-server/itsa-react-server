'use strict';

const preboot = require('preboot'), // see: https://universal.angular.io/api/preboot/index.html
    prebootOptions = {
        appRoot: '#view-container',
        uglify: true,
        buffer: false
    };  // see options section below

const startScript = () => {
    return {__html: preboot.getInlineCode(prebootOptions)};
};

const endScript = () => {
    // we NEEd to go async --> otherwise reboot.complete doesn't work well and leaves stuff behind!
    return {__html: 'setTimeout(function(){preboot.complete()},0);'};
};

module.exports = {
    startScript,
    endScript
};

/* OPTIONS
There are 5 different types of options that can be passed into preboot:

1. Selectors

appRoot - A selector that can be used to find the root element for the view (default is 'body')
2. Strategies

These can either be string values if you want to use a pre-built strategy that comes with the framework or you can implement your own strategy and pass it in here as a function or object.

listen - How preboot listens for events. See Listen Strategies below for more details.
replay - How preboot replays captured events on client view. See Replay Strategies below for more details.
freeze - How preboot freezes the screen when certain events occur. See Freeze Strategies below for more details.
3. Flags

All flags false by default.

focus - If true, will track and maintain focus even if page re-rendered
buffer - If true, client will write to a hidden div which is only displayed after bootstrap complete
keyPress - If true, all keystrokes in a textbox or textarea will be transferred from the server view to the client view
buttonPress - If true, button presses will be recorded and the UI will freeze until bootstrap complete
pauseOnTyping - If true, the preboot will not complete until user focus out of text input elements
doNotReplay - If true, none of the events recorded will be replayed
4. Workflow Events

These are the names of global events that can affect the preboot workflow:

pauseEvent - When this is raised, preboot will delay the play back of recorded events (default 'PrebootPause')
resumeEvent - When this is raised, preboot will resume the playback of events (default 'PrebootResume')
5. Build Params

uglify - You can always uglify the output of the client code stream yourself, but if you set this option to true preboot will do it for you.
*/
