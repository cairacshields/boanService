var express = require("express"),
	bodyParser = require('body-parser'),
 	async = require('asyncawait/async'),
 	await = require('asyncawait/await'),
 	stripe = require("stripe")("sk_test_km8Vo3mjUEOtkU2SaizC6QmR"),
 	admin = require('firebase-admin'),
 	serviceAccount = require('./serviceAccountKey.json'),
 	schedule = require('node-schedule'),
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
						             res.statusMessage = "There was an error line 69";
						             res.send("There was an error " + err);
						            
						         }else if(err){
						         	console.log("an error on line 72 " + err);
									res.write("The card has been declined" + err)
						         }else{
						         	res.send("Charge results " + charge);
						         	res.statusMessage = "Lender charged " + charge.amount;
						         	console.log("an error on line 76");
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
						             res.send({statusMessage : "There was an error " + err});
						            
						         }else if(err){
						         	console.log("an error on line 108 " + err);
									res.write("The card has been declined" + err)
						         }else{
						         	console.log("Something is up... " + user.customerId);
						         	res.send({statusMessage : "Charge results " + charge});

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

//Also need to create a function that will run once every day to check for scheduled payments.
// Step 1. Using node-schedule, we create a job that will run once every day 
//Step 2. This job will use a reference to the DB that stores the pending repay nodes, to grab the repay date attached to them
	// and check it against today's date. 
//If the dates match, we will attempt to charge the borrower, if that dates don't match... we will just skip it 
//TODO ~~ we also need to handle what happens when the charge fails... will we change the date? 

//This job is supposed to run every day at 01:00 
schedule.scheduleJob('0 1 * * *', function(){
  
	var refTermsAgreements = db.ref("termsAgreements");

	//This is going to use the DB reference to grab each termsAgreement once. Inside here, we can check the 'accepted' value
	refTermsAgreements.once("value", function(data) {
  			//The terms agreement has been accepted and the lender was charged. 
  			//Let's go through all the termsAgreements using a forEach loop
  			data.forEach(function(childSnapshot) {
  				 var childData = childSnapshot.val();
  				 var key = childSnapshot.key;
  				 //Make sure the terms agreement has been accepted before going forward 
  				 if(childData.accepted == true){
	  				//Time to check the repay date, against today's date.
		  			 var repayDate = new Date(childData.repayDate.time).toLocaleDateString("en-US");
		  			 var todaysDate = new Date().toLocaleDateString("en-US");

		  			 if(repayDate.valueOf() == todaysDate.valueOf()){
		  			 	//The repayDate is the same as today's date! Charge them! 
							var centAmount = childData.repayAmount * 100;
							var customer = null;

							var refUsers = db.ref("users/"+childData.borrowerUserId);

							//Step 1. check the DB to see if the user already has a customer ID on file 
						   refUsers.on("value", function(snapshot) {
								var user = snapshot.val();
								var stripeToken = user.stripeToken;
								var userEmail = user.email;
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
												             console.log("The card has been declined for repayment");
												             //Add code to change repay date to tomorrow 
												             var date = new Date(childData.repayDate);
												             var newRepayDate = date.setDate(date.getDate() + 1);


												         }else if(err){
												         	console.log("an error on line 197 for repayment" + err);
															//Add code to change repay date to tomorrow 

												         }else{
												         	console.log("Charged for repayment");
												         	//now completely remove the terms agreement from DB 
												         }
												     });

											 	//Also need to set the new customerId value in the DB 
											 	refUsers.child("customerId").set(customer.id);
											 	console.log("Request is processing... creating new customer and sending the charge")

											 	}else{
											 		res.write("error line 212 repayment" + err);
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
												             console.log("The card has been declined for repayment");
												           	//Add code to change repay date to tomorrow 
												            
												         }else if(err){
												         	console.log("an error on line 108 for repayment" + err);
															//Add code to change repay date to tomorrow 
												         }else{
												         	console.log("Charged for repayment");
												         	//now completely remove the terms agreement from DB 
												         }
												     });
									    	console.log("Request is processing... using the existing customer id to create a charge.")
									    }else{ 
									    	res.write("error line 243 for repayment" + err);
									    }
									  }
									);
								}
							
							}, function (err, errorObject) {
								console.log("The read failed: " + errorObject.code);
								res.send(errorObject.code);
							});
		  			 

		  			 	console.log(repayDate.valueOf() + " same as " + todaysDate.valueOf());
		  			 }else{
		  			 	//The repay date is NOT today... leave the terms agreement alone 
		  			 	console.log(repayDate.valueOf() + " not the same date as " + todaysDate.valueOf());
		  			 }
				  
			  }else{
			  	//Terms agreement hasn't been accepted yet... leave it alone 
			  }

  			});
		});

	console.log("Daily job ran");
});

app.get("/", ( req, res, next) => {
	res.json(["Tony","Lisa","Michael","Ginger","Food"]);
});

app.listen(3000, () => {
 console.log("Server running on port 3000");
});