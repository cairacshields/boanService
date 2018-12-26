var express = require("express"),
	bodyParser = require('body-parser'),
 	async = require('asyncawait/async'),
 	await = require('asyncawait/await'),
 	stripe = require("stripe")("sk_test_km8Vo3mjUEOtkU2SaizC6QmR"),
 	admin = require('firebase-admin'),
 	serviceAccount = require('./serviceAccountKey.json');
	app = express();

//App configurations below
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://boan-744fb.firebaseio.com"
});

// As an admin, the app has access to read and write all data, regardless of Security Rules
var db = admin.database();
var ref = db.ref("restricted_access/secret_document");
ref.once("value", function(snapshot) {
  console.log(snapshot.val());
}, function (errorObject) {
  console.log("The read failed: " + errorObject.code);
});

//var refUsers = db.ref("users/"); //base db reference to the user node... need to chain the userId 

// app.use(bodyParser());

//Need to send the following items in the request body on the client side
/*
1. stripeToken
2. user email
3. charge amount in cents 
*/
app.post("/charge", function(req, res){
	var stripeToken = req.body.stripeToken;
	var userEmail = req.body.email;
	var userId = req.body.userId;
	var centAmount = req.body.amount;
	var customer = null;

	var refUsers = db.ref("users/"+userId);

	//Step 1. check the DB to see if the user already has a customer ID on file 
   refUsers.on("value", function(snapshot) {
		var user = snapshot.val();
		if(user.customerId == null){
			//Current user, does not have a customer id... we need to create a customer object for them 
			stripe.customers.create({
				 	    source: stripeToken,
				 	    email: userEmail
				 	 }, function(err, customer) {
					  // asynchronously called
					  	//As long as the newly created customer object is not null, we can go ahead with the charge
					  	if(customer != null){
					  	   var customer =  customer;
					 	   var charge = stripe.charges.create({
						        amount: centAmount,
						     	currency: 'usd',
						     	customer: customer.id
						     }, 
						     function(err, charge) {
						         if (err && err.type === 'StripeCardError') {
						             console.log("The card has been declined");
						             res.write("The card has been declined" + err)
						             res.send("There was an error " + err);
						            
						         }else if(err){
									res.write("The card has been declined" + err)
						         }else{
						         	res.send("Charge results " + charge);
						         }
						     });

					 	//Also need to set the new customerId value in the DB 
					 	refUsers.child("customerId").set(customer.id);
					 	console.log("Request is processing... creating new customer and sending the charge")
					 	// res.send("Request is processing... creating new customer and sending the charge");

					 	}else{
					 		res.write("error line 79 " + err);
					 	}
					});
		}else if(user.customerId != null){
			//The user already has a customer Id saved in the DB... just retreive that and create a charge 
			stripe.customers.retrieve(
			  user.customerId,
			  function(err, customer) {
			    // asynchronously called
			    if(customer != null){
			    	//we've got the customer using the existing customer id 
			    	//Now just charge them 
			    	var charge = stripe.charges.create({
						        amount: centAmount,
						     	currency: 'usd',
						     	customer: customer.id
						     }, 
						     function(err, charge) {
						         if (err && err.type === 'StripeCardError') {
						             console.log("The card has been declined");
						             res.write("The card has been declined" + err)
						             res.send("There was an error " + err);
						            
						         }else if(err){
									res.write("The card has been declined" + err)
						         }else{
						         	res.send("Charge results " + charge);
						         }
						     });
			    	console.log("Request is processing... using the existing customer id to create a charge.")
			    	//res.send("Request is processing... using the existing customer id to create a charge.");
			    }else{ 
			    	res.write("error line 107 " + err);
			    }
			  }
			);
		}
	
	}, function (err, errorObject) {
		console.log("The read failed: " + errorObject.code);
		res.send(errorObject.code);
	});
	  
 });   

app.get("/", ( req, res, next) => {
 res.json(["Tony","Lisa","Michael","Ginger","Food"]);
});

app.listen(3000, () => {
 console.log("Server running on port 3000");
});