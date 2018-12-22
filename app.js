var express = require("express");
var bodyParser = require('body-parser');
// Set your secret key: remember to change this to your live secret key in production
// See your keys here: https://dashboard.stripe.com/account/apikeys
var stripe = require("stripe")("sk_test_km8Vo3mjUEOtkU2SaizC6QmR");
var app = express();
app.use(bodyParser());


app.get("/url", (req, res, next) => {
 res.json(["Tony","Lisa","Michael","Ginger","Food"]);
});

app.listen(3000, () => {
 console.log("Server running on port 3000");
});