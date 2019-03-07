var express = require("express"),
	bodyParser = require('body-parser'),
 	async = require('asyncawait/async'),
 	await = require('asyncawait/await'),
 	stripe = require("stripe")("sk_test_km8Vo3mjUEOtkU2SaizC6QmR"),
 	admin = require('firebase-admin'),
 	serviceAccount = require('./serviceAccountKey.json'),
 	schedule = require('node-schedule'),
 	request = require('request'),
 	dateFormat = require('dateformat'),
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
	var borrowerUserId = req.body.borrowerUserId;
	var centAmount = req.body.amount;
	var fee = req.body.fee;
	var borrower = null;
	var customer = null;

	var refUsers = db.ref("users/"+userId);
	var refBorrowingUser = db.ref("users/"+borrowerUserId);

	refBorrowingUser.once("value", function(snapshot){
		 borrower = snapshot.val();
	});

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
					  	var newAmount = centAmount + fee;
					  	if(customer != null){
					  	   var customer =  customer;
					 	   var charge = stripe.charges.create({
						        amount: newAmount,
						     	currency: 'usd',
						     	customer: customer.id,
						     	metadata: {'fee': fee, 'lender_user_id': userId, 'borrower_user_id': borrowerUserId ,'charge_reason': 'Lender was charged for active borrow request'}
						     }, 
						     function(err, charge) {
						         if (err && err.type === 'StripeCardError') {
						             console.log("The card has been declined");
						             res.write("The card has been declined" + err);
						             res.statusMessage = "There was an error line 82";
						             res.send("There was an error " + err);
						            
						         }else if(err){
						         	console.log("an error on line 86 " + err);
									res.write("The card has been declined" + err);
						         }else{
						      
						         	console.log("Lender charged... from line 90");

						         		console.log(borrower.username);
						        
						         		//Send the borrower the money 
						         		stripe.transfers.create({
										  amount: centAmount,
										  currency: "usd",
										  destination: borrower.stripe_user_id,
										  metadata: {'lender_user_id': userId,'borrower_user_id': borrowerUserId, 'transfer_reason': 'Lender sent money to borrower.'}
										}, function(err, transfer) {
										  // asynchronously called
										  if(err){
										  	console.log(err);
										  }else{
										  	console.log(transfer);
										  }
										});
						        
						         
									res.send("Charge results " + charge);
						         	res.statusMessage = "Lender charged " + charge.amount;
						         }
						     });

					 	//Also need to set the new customerId value in the DB 
					 	refUsers.child("customerId").set(customer.id);
					 	console.log("Request is processing... creating new customer and sending the charge");
					 	}else{
					 		res.write("error line 119 " + err);
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
			    	var newAmount = centAmount + fee;
			    	var charge = stripe.charges.create({
						        amount: newAmount,
						     	currency: 'usd',
						     	customer: customer.id,
						     	metadata: {'fee': fee, 'lender_user_id': userId, 'borrower_user_id': borrowerUserId ,'charge_reason': 'Lender was charged for active borrow request'}
						     }, 
						     function(err, charge) {
						         if (err && err.type === 'StripeCardError') {
						             console.log("The card has been declined");
						             res.write("The card has been declined" + err);
						             res.send({statusMessage : "There was an error " + err});
						            
						         }else if(err){
						         	console.log("an error on line 145 " + err + " " + newAmount + " ," + centAmount + " ," + fee);
									res.write("The card has been declined" + err);
						         }else{
						         	console.log("Charge went through line 148... " + user.customerId);
						         	
						         		console.log(borrower.username);
						         		//Send the borrower the money 
						         		stripe.transfers.create({
										  amount: centAmount,
										  currency: "usd",
										  destination: borrower.stripe_user_id,
										  metadata: {'lender_user_id': userId,'borrower_user_id': borrowerUserId, 'transfer_reason': 'Lender sent money to borrower.'}
										}, function(err, transfer) {
										  // asynchronously called
										  if(err){
										  	console.log(err);
										  }else{
										  	console.log(transfer);
										  }
										});
							         
						         	console.log("Charge went through line 143... charge results: " + charge);
						         	//res.send({statusMessage : "Charge results " + charge});

						         }
						     });
			    	console.log("Request is processing... using the existing customer id to create a charge.");
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


app.post("/connectExpress", function(req, res){
	var code = req.body.code;
	var userId = req.body.userId;

	var refUsers = db.ref("users/"+userId);

	request.post({url:'https://connect.stripe.com/oauth/token', form: {
		"client_secret":'sk_test_km8Vo3mjUEOtkU2SaizC6QmR',
		"code": code,
		"grant_type": "authorization_code"
	}}, function(err,httpResponse,body){
	 	if(err){
	 		console.log(err +" "+ body);
	 		res.send(err +" "+ body);
	 	}else if(httpResponse){
	 		var parsedBody = JSON.parse(body);
	 		console.log("Response " + body);
	 		res.send(body);

	 		refUsers.child("stripe_user_id").set(parsedBody.stripe_user_id);

	 	}
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
	var refBorrowRequests = db.ref("borrowRequests");

	//Another thing we need to do is account for borrowRequests that never receive any termsAgreements 
	//Esentially, what we should do is check against the repayDate and todaysDate (maybe?)... and if those two are the same, AND 
	// if the value of 'requestClosed' is FALSE, than we can assume that they have not accepted any, or have not received any terms agreements 
	//therefore, we will remove the borrowRequest and update the users 'hasActiveBorrowRequest' value to FALSE
	refBorrowRequests.once("value", function(requests){
		requests.forEach(function(childSnapshot){
			var childData = childSnapshot.val();
  			var key = childSnapshot.key;

			var repayDate = new Date(childData.repayDate.time()).toLocaleDateString("en-US");
  			//var repayDate = new Date(childData.repayDate).getTime();
  			var todaysDate = new Date().toLocaleDateString("en-US");
		  	//var todaysDate = new Date().getTime();

		  	if(repayDate.valueOf() == todaysDate.valueOf()){
		  		if(childData.requestClosed != true){
		  			//We're going to remove that borrow request... so they will no longer have an active one
		  			db.ref("users/"+childData.userId).child("hasActiveBorrowRequest").set(false);
		  			//Seems like this request has either, not received terms agreements, or has not accepted any 
		  			//So we'll remove it. 
		  			refBorrowRequests.child(key).removeValue();
		  			console.log("Borrow request removed due to non acceptence of terms agreements, or not receiving any terms agreements.");
		  		}
		  	}
		});
	});

	//This is going to use the DB reference to grab each termsAgreement once. Inside here, we can check the 'accepted' value
	refTermsAgreements.once("value", function(data) {
  			//The terms agreement has been accepted and the lender was charged. 
  			//Let's go through all the termsAgreements using a forEach loop
  			data.forEach(function(childSnapshot) {
  				 var childData = childSnapshot.val();
  				 var key = childSnapshot.key;
  				 //Make sure the terms agreement has been accepted before going forward 
  				 if(childData.accepted == true){
  				 	if(childData.borrowerRepayed != true){
	  				//Time to check the repay date, against today's date.
		  			var repayDate = new Date(childData.repayDate.time()).toLocaleDateString("en-US");
  					//var repayDate = new Date(childData.repayDate).getTime();
  					var todaysDate = new Date().toLocaleDateString("en-US");
		  			//var todaysDate = new Date().getTime();

		  			 if(repayDate.valueOf() == todaysDate.valueOf()){
		  			 	//The repayDate is the same as today's date! Charge them! 
							var centAmount = childData.repayAmount * 100;
							var fee = childData.fee;
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
												        amount: centAmount + fee,
												     	currency: 'usd',
												     	customer: customer.id,
												     	metadata: {'fee': fee, 'lender_user_id': childData.lenderUserId, 'borrower_user_id': childData.borrowerUserId ,'charge_reason': 'Borrower was charged for active borrow request'}
												     }, 
												     function(err, charge) {
												         if (err && err.type === 'StripeCardError') {
												             console.log("The card has been declined for repayment");
												             //Add code to change repay date to tomorrow 
												             var date = new Date(childData.repayDate);
												             var newRepayDate = date.setDate(date.getDate() + 1);

												             //Not sure if this will work... but the hope is that, using the DB reference, we can grab the termsAgreement
												             	//Then grab the original repayDate from that agreement and replace it with the newRepayDate.
												             console.log("Tried changing the repayDate on line 269");		
												             refTermsAgreements.child(childData.lenderUserId).child("repayDate").set(newRepayDate);


												         }else if(err){
												         	console.log("an error on line 197 for repayment" + err);
															//Add code to change repay date to tomorrow 
															var date = new Date(childData.repayDate);
												             var newRepayDate = date.setDate(date.getDate() + 1);

												             //Not sure if this will work... but the hope is that, using the DB reference, we can grab the termsAgreement
												             	//Then grab the original repayDate from that agreement and replace it with the newRepayDate.
												             console.log("Tried changing the repayDate on line 280");		
												             refTermsAgreements.child(childData.lenderUserId).child("repayDate").set(newRepayDate);

												         }else{
												         	console.log("Charged for repayment, agreement updated");
												         	//now update the 'borrowerRepayed' value to be true
												         	refTermsAgreements.child(childData.lenderUserId).child("borrowerRepayed").set(true);
												         	refUsers.child("hasActiveBorrowRequest").set(false);
												         }
												     });

											 	//Also need to set the new customerId value in the DB 
											 	refUsers.child("customerId").set(customer.id);
											 	console.log("Request is processing... creating new customer and sending the charge line 332");

											 	}else{
											 		res.write("error line 335 repayment" + err);
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
												        amount: centAmount + fee,
												     	currency: 'usd',
												     	customer: customer.id,
												     	metadata: {'fee': fee, 'lender_user_id': childData.lenderUserId, 'borrower_user_id': childData.borrowerUserId ,'charge_reason': 'Borrower was charged for active borrow request'}
												     }, 
												     function(err, charge) {
												         if (err && err.type === 'StripeCardError') {
												             console.log("The card has been declined for repayment 355");
												           	//Add code to change repay date to tomorrow 
												           	 var date = new Date(childData.repayDate);
												             var newRepayDate = date.setDate(date.getDate() + 1);

												             //Not sure if this will work... but the hope is that, using the DB reference, we can grab the termsAgreement
												             	//Then grab the original repayDate from that agreement and replace it with the newRepayDate.
												             console.log("Tried changing the repayDate on line 362");		
												             refTermsAgreements.child(childData.lenderUserId).child("repayDate").set(newRepayDate);
												            
												         }else if(err){
												         	console.log("an error on line 366 for repayment" + err);
															//Add code to change repay date to tomorrow 
															 var date = new Date(childData.repayDate);
												             var newRepayDate = date.setDate(date.getDate() + 1);

												             //Not sure if this will work... but the hope is that, using the DB reference, we can grab the termsAgreement
												             	//Then grab the original repayDate from that agreement and replace it with the newRepayDate.
												             console.log("Tried changing the repayDate on line 373");	
												             refTermsAgreements.child(childData.lenderUserId).child("repayDate").set(newRepayDate);
												         }else{
												         	console.log("Charged for repayment, agreement removed 376");
												         	//now completely remove the terms agreement from DB 
												         	refTermsAgreements.child(childData.lenderUserId).child("borrowerRepayed").set(true);
												         	refUsers.child("hasActiveBorrowRequest").set(false);
												         }
												     });
									    	console.log("Request is processing... using the existing customer id to create a charge line 382.");
									    }else{ 
									    	console.log("Error retrieving customer on line 384");
									    	res.write("error line 358 for repayment" + err);
									    }
									  }
									);
								}
							
							}, function (err, errorObject) {
								console.log("The read failed: " + errorObject.code);
								res.send(errorObject.code);
							});
		  			 

		  			 	console.log(repayDate.valueOf() + " same as " + todaysDate.valueOf() + " line 398");
		  			 }else{
		  			 	//The repay date is NOT today... leave the terms agreement alone 
		  			 	console.log(repayDate.valueOf() + " not the same date as " + todaysDate.valueOf() + " line 401");
		  			 }
				  
			  }else{
			  	//Terms agreement has been accepted and borrower repaid... time to send the lender back their money and completey remove the termAgreement 
			  	var refUser = db.ref("users/"+childData.lenderUserId);
			  	refUser.on("value", function(snapshot) {
					var user = snapshot.val();
					//Here we're using the users Stripe connect account (stripe_user_id) and Stripe transfers to send the lender back their repayAmount 
					//Send the lender their money back!
						stripe.transfers.create({
							amount: childData.repayAmount * 100,
							currency: "usd",
							destination: user.stripe_user_id,
							metadata: {'lender_user_id': childData.lenderUserId,'borrower_user_id': childData.borrowerUserId, 'transfer_reason': 'Borrower repayed lender.'}
							}, function(err, transfer) {
							// asynchronously called
								if(err){
									console.log("line 418");
									console.log(err);
								}else{
									//Transfer seems to have went through, so remove the terms agreement here
									console.log("line 422");
									console.log(transfer);
									refTermsAgreements.child(childData.lenderUserId).removeValue();
								}
						});

				}, function (err, errorObject) {
					console.log("The read failed line 429: " + errorObject.code);
					res.send(errorObject.code);
				});
			  }

			 }else{
				//Terms agreement hasn't been accepted yet... leave it alone 
			  	console.log("Terms agreement " + childData.id + " has not been accepted line 436");
			 }
  			});
		});

	console.log("Daily job ran at " + dateFormat(new Date(), "ddd mmm dd yyyy HH:MM:ss UTC" ));
	//console.log("Daily job ran at " + Date.now());
});

//Testing Scheduled job route 
app.get("/testing", (req, res, next) => {

	var refTermsAgreements = db.ref("termsAgreements");
	var refBorrowRequests = db.ref("borrowRequests");

	//Another thing we need to do is account for borrowRequests that never receive any termsAgreements 
	//Esentially, what we should do is check against the repayDate and todaysDate (maybe?)... and if those two are the same, AND 
	// if the value of 'requestClosed' is FALSE, than we can assume that they have not accepted any, or have not received any terms agreements 
	//therefore, we will remove the borrowRequest and update the users 'hasActiveBorrowRequest' value to FALSE
	refBorrowRequests.once("value", function(requests){
		requests.forEach(function(childSnapshot){
			var childData = childSnapshot.val();
  			var key = childSnapshot.key;

			var repayDate = new Date(childData.repayDate.time).toLocaleDateString("en-US");
  			//var repayDate = new Date(childData.repayDate).getTime();
  			var todaysDate = new Date().toLocaleDateString("en-US");
		  	//var todaysDate = new Date().getTime();


		  	var date = new Date(); 
			var now_utc =  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
 			date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());



		  	if(repayDate.valueOf() == todaysDate.valueOf()){
		  		if(childData.requestClosed != true){
		  			//We're going to remove that borrow request... so they will no longer have an active one
		  			db.ref("users/"+childData.userId).child("hasActiveBorrowRequest").set(false);
		  			//Seems like this request has either, not received terms agreements, or has not accepted any 
		  			//So we'll remove it. 
		  			refBorrowRequests.child(key).removeValue();
		  			console.log("Borrow request removed due to non acceptence of terms agreements, or not receiving any terms agreements.");
		  		}
		  	}else{
				console.log("Borrow request not removed on line 475, date isn't the same. " + todaysDate
					+ " " + repayDate);
		  	}
		});
	});

	//This is going to use the DB reference to grab each termsAgreement once. Inside here, we can check the 'accepted' value
	refTermsAgreements.once("value", function(data) {
  			//The terms agreement has been accepted and the lender was charged. 
  			//Let's go through all the termsAgreements using a forEach loop
  			data.forEach(function(childSnapshot) {
  				 var childData = childSnapshot.val();
  				 var key = childSnapshot.key;
  				 //Make sure the terms agreement has been accepted before going forward 
  				 if(childData.accepted == true){
  				 	if(childData.borrowerRepayed != true){
	  				//Time to check the repay date, against today's date.
		  			var repayDate = new Date(childData.repayDate.time()).toLocaleDateString("en-US");
  					//var repayDate = new Date(childData.repayDate).getTime();
  					var todaysDate = new Date().toLocaleDateString("en-US");
		  			//var todaysDate = new Date().getTime();

		  			 if(repayDate.valueOf() == todaysDate.valueOf()){
		  			 	//The repayDate is the same as today's date! Charge them! 
							var centAmount = childData.repayAmount * 100;
							var fee = childData.fee;
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
												        amount: centAmount + fee,
												     	currency: 'usd',
												     	customer: customer.id,
												     	metadata: {'fee': fee, 'lender_user_id': childData.lenderUserId, 'borrower_user_id': childData.borrowerUserId ,'charge_reason': 'Borrower was charged for active borrow request'}
												     }, 
												     function(err, charge) {
												         if (err && err.type === 'StripeCardError') {
												             console.log("The card has been declined for repayment");
												             //Add code to change repay date to tomorrow 
												             var date = new Date(childData.repayDate);
												             var newRepayDate = date.setDate(date.getDate() + 1);

												             //Not sure if this will work... but the hope is that, using the DB reference, we can grab the termsAgreement
												             	//Then grab the original repayDate from that agreement and replace it with the newRepayDate.
												             console.log("Tried changing the repayDate on line 269");		
												             refTermsAgreements.child(childData.lenderUserId).child("repayDate").set(newRepayDate);


												         }else if(err){
												         	console.log("an error on line 197 for repayment" + err);
															//Add code to change repay date to tomorrow 
															var date = new Date(childData.repayDate);
												             var newRepayDate = date.setDate(date.getDate() + 1);

												             //Not sure if this will work... but the hope is that, using the DB reference, we can grab the termsAgreement
												             	//Then grab the original repayDate from that agreement and replace it with the newRepayDate.
												             console.log("Tried changing the repayDate on line 280");		
												             refTermsAgreements.child(childData.lenderUserId).child("repayDate").set(newRepayDate);

												         }else{
												         	console.log("Charged for repayment, agreement updated");
												         	//now update the 'borrowerRepayed' value to be true
												         	refTermsAgreements.child(childData.lenderUserId).child("borrowerRepayed").set(true);
												         	refUsers.child("hasActiveBorrowRequest").set(false);
												         }
												     });

											 	//Also need to set the new customerId value in the DB 
											 	refUsers.child("customerId").set(customer.id);
											 	console.log("Request is processing... creating new customer and sending the charge line 332");

											 	}else{
											 		res.write("error line 335 repayment" + err);
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
												        amount: centAmount + fee,
												     	currency: 'usd',
												     	customer: customer.id,
												     	metadata: {'fee': fee, 'lender_user_id': childData.lenderUserId, 'borrower_user_id': childData.borrowerUserId ,'charge_reason': 'Borrower was charged for active borrow request'}
												     }, 
												     function(err, charge) {
												         if (err && err.type === 'StripeCardError') {
												             console.log("The card has been declined for repayment 355");
												           	//Add code to change repay date to tomorrow 
												           	 var date = new Date(childData.repayDate);
												             var newRepayDate = date.setDate(date.getDate() + 1);

												             //Not sure if this will work... but the hope is that, using the DB reference, we can grab the termsAgreement
												             	//Then grab the original repayDate from that agreement and replace it with the newRepayDate.
												             console.log("Tried changing the repayDate on line 362");		
												             refTermsAgreements.child(childData.lenderUserId).child("repayDate").set(newRepayDate);
												            
												         }else if(err){
												         	console.log("an error on line 366 for repayment" + err);
															//Add code to change repay date to tomorrow 
															 var date = new Date(childData.repayDate);
												             var newRepayDate = date.setDate(date.getDate() + 1);

												             //Not sure if this will work... but the hope is that, using the DB reference, we can grab the termsAgreement
												             	//Then grab the original repayDate from that agreement and replace it with the newRepayDate.
												             console.log("Tried changing the repayDate on line 373");	
												             refTermsAgreements.child(childData.lenderUserId).child("repayDate").set(newRepayDate);
												         }else{
												         	console.log("Charged for repayment, agreement removed 376");
												         	//now completely remove the terms agreement from DB 
												         	refTermsAgreements.child(childData.lenderUserId).child("borrowerRepayed").set(true);
												         	refUsers.child("hasActiveBorrowRequest").set(false);
												         }
												     });
									    	console.log("Request is processing... using the existing customer id to create a charge line 382.");
									    }else{ 
									    	console.log("Error retrieving customer on line 384");
									    	res.write("error line 358 for repayment" + err);
									    }
									  }
									);
								}
							
							}, function (err, errorObject) {
								console.log("The read failed: " + errorObject.code);
								res.send(errorObject.code);
							});
		  			 

		  			 	console.log(repayDate.valueOf() + " same as " + todaysDate.valueOf() + " line 398");
		  			 }else{
		  			 	//The repay date is NOT today... leave the terms agreement alone 
		  			 	console.log(repayDate.valueOf() + " not the same date as " + todaysDate.valueOf() + " line 401");
		  			 }
				  
			  }else{
			  	//Terms agreement has been accepted and borrower repaid... time to send the lender back their money and completey remove the termAgreement 
			  	var refUser = db.ref("users/"+childData.lenderUserId);
			  	refUser.on("value", function(snapshot) {
					var user = snapshot.val();
					//Here we're using the users Stripe connect account (stripe_user_id) and Stripe transfers to send the lender back their repayAmount 
					//Send the lender their money back!
						stripe.transfers.create({
							amount: childData.repayAmount * 100,
							currency: "usd",
							destination: user.stripe_user_id,
							metadata: {'lender_user_id': childData.lenderUserId,'borrower_user_id': childData.borrowerUserId, 'transfer_reason': 'Borrower repayed lender.'}
							}, function(err, transfer) {
							// asynchronously called
								if(err){
									console.log("line 418");
									console.log(err);
								}else{
									//Transfer seems to have went through, so remove the terms agreement here
									console.log("line 422");
									console.log(transfer);
									refTermsAgreements.child(childData.lenderUserId).removeValue();
								}
						});

				}, function (err, errorObject) {
					console.log("The read failed line 429: " + errorObject.code);
					res.send(errorObject.code);
				});
			  }

			 }else{
				//Terms agreement hasn't been accepted yet... leave it alone 
			  	console.log("Terms agreement " + childData.id + " has not been accepted line 436");
			 }
  			});
		});

	console.log("Daily job ran at " + dateFormat(new Date(), "ddd mmm dd yyyy HH:MM:ss UTC" ));
	//console.log("Daily job ran at " + Date.now());
});





app.get("/", ( req, res, next) => {
	res.json(["Tony","Lisa","Michael","Ginger","Food"]);
});

app.listen(3000, () => {
 console.log("Server running on port 3000");
});