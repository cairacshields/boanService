var express = require("express");
var bodyParser = require('body-parser');
// Set your secret key: remember to change this to your live secret key in production
// See your keys here: https://dashboard.stripe.com/account/apikeys
var stripe = require("stripe")("sk_test_km8Vo3mjUEOtkU2SaizC6QmR");
var app = express();
// set the port of our application
// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 8080
app.use(bodyParser());


app.get("/url", (req, res, next) => {
 res.json(["Tony","Lisa","Michael","Ginger","Food"]);
});

app.listen(port, () => {
 console.log("Server running on port 3000");
});