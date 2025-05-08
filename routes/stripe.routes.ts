import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { query } from '../config/db.config';

dotenv.config();
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
});

// Use raw body for Stripe webhook verification
router.post('/', async (req: Request, res: Response) => {
console.log(process.env.STRIPE_SECRET_KEY)

  const sig = req.headers['stripe-signature'] as string;
  console.log(sig, req.body)
  let event: any;

  try {
    event = await stripe.webhooks.constructEventAsync(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err) {
    console.error('❌ Webhook signature verification failed.', err);
     res.status(400).send(`Webhook Error: ${err}`);
     return
  }

  // ✅ Handle successful checkout
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const customerId = session.customer as string;
    try{
    
    }
    catch(err:any){
      console.log("Error in session", err.message)
    }

    const clientReferenceId = session.client_reference_id?.split(" ")[0].trim()// if you're passing user ID in frontend
    const selectedPlan = session.client_reference_id?.split(" ")[1].toUpperCase().trim()// if you're passing user ID in frontend
    console.log(clientReferenceId, selectedPlan, "aaa")

    console.log(clientReferenceId)
    // console.log("selectedPlan", selectedPlan)
    // ✅ Store subscription info in DB here (pseudo-code):
    await query(`UPDATE users SET is_paid = $1 WHERE id = $2`, [selectedPlan, clientReferenceId]);


    console.log('✅ Checkout completed for customer:', clientReferenceId, selectedPlan);
  }

  res.send({ received: true });
});

export default router;
