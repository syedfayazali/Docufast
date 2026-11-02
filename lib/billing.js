// Creates a recurring (AutoPay) Razorpay subscription for one of our plans.
// The Razorpay plan is created once per plan + term + price and then reused.
import { getOrCreateRzpPlanId } from '@/lib/db';
import { createRzpPlan, createRzpSubscription } from '@/lib/razorpay';
import { planAmount, rzpPeriod, rzpTotalCount } from '@/lib/plans';

export async function newSubscription(plan, term, notes, startAt) {
  const amountPaise = planAmount(plan, term) * 100;
  const planId = await getOrCreateRzpPlanId(`${(process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test') ? 'test' : 'live'}-${plan.id}-${term}-${amountPaise}`,   // test and live plans are different objects at Razorpay
    
    () => createRzpPlan({ period: rzpPeriod(term), name: `DocuFast ${plan.name} (${term})`, amountPaise }));
  return createRzpSubscription({ planId, totalCount: rzpTotalCount(term), notes, startAt });
}
