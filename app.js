var express = require("express"),
	bodyParser = require('body-parser'),
 	stripe = require("stripe")("sk_test_km8Vo3mjUEOtkU2SaizC6QmR"),
	app = express();

//App configurations below
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

// app.use(bodyParser());

//Need to send the following items in the request body on the client side
/*
1. stripeToken
2. user email
3. charge amount in cents 

*/
//  app.post('/charge', function(req, res) {
//     var stripeToken = req.body.stripeToken;

//  	(async function() {
//  	  // Create a Customer:
//  	  const customer = await stripe.customers.create({
//  	    source: stripeToken,
//  	    email: req.body.email,
//  	  });

//      var charge = stripe.charges.create({
//          amount: req.body.amount,
//      	currency: 'usd',
//      	customer: customer.id
//      }, 
//      function(err, charge) {
//          if (err && err.type === 'StripeCardError') {
//              console.log("The card has been declined");
//              res.write("The card has been declined" + err)
//              res.send("The card has been declined" + err)
            
//          }else if(err){
// 			res.write("The card has been declined" + err)
//              res.send("The card has been declined" + err)
//          }
//      }); 
//   });
// });
     // YOUR CODE: Save the customer ID and other info in a database for later.
     
app.post("/charge", function(req, res){
	res.write("Hello, World " + req.body);
});     

app.get("/", ( req, res, next) => {
 res.json(["Tony","Lisa","Michael","Ginger","Food"]);
});

app.listen(3000, () => {
 console.log("Server running on port 3000");
});