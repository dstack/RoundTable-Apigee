#RoundTable
An interactive presentation application, powered by Apigee App Services and NodeJS.

###What this is ...
This is a demonstration of the RoundTable presentation system, which uses HTML5 and open-source JavaScript to turn a deck-style presentation into a platform for viewer engagement.  Typical presentations take place on just a projection surface (1 screen), or sometimes a projection surface with a secondary display to show the presenter their notes and control the presentation (2 screens).  RoundTable takes this one step further by creating a third screen, the "viewer" screen, which allows interaction in the form of asking a question without interrupting the presentation.

##Running this Demo
To run this demo you only need an Apigee App Services account (free) and NodeJS (also free).

####Install NodeJS
[Get Node](http://nodejs.org) for your operating system, and install it.  It runs on just about anything, and they have really great instructions on how to get started for any OS.

####Apigee App Services
[Signup for Apigee App Services](https://accounts.apigee.com/accounts/sign_up?callback=https://apigee.com/usergrid).  It's free and is the data-store for almost everything in this demo application.

####Create keys.json
There is an example keys.json file in the root of the project, just copy and rename to "keys.json" and put in your Apigee App Services details.

####Start the Application
From the root of the project, open a console and run "node rt.js".  This will start a small HTTP server on your machine, along with everything RoundTable needs to run.  Your console should tell you which port it's running on (4295 by default) and once it does you can point your browser at http://localhost:4295 (or whatever port you are running it on).