# Security policy

DocuFast handles customers' personal documents (ID proofs, certificates), so we
treat security reports seriously.

## Reporting a vulnerability

Please report it privately through GitHub: open this repository's **Security**
tab and choose **Report a vulnerability**. Do not open a public issue.

Include what you found, how to reproduce it, and what it could expose. We aim to
reply within 3 working days and to fix confirmed problems as quickly as we can.

## How customer files are handled

- Uploaded files are stored in private storage and are never reachable by a
  public link.
- A shop's print agent downloads a file through a signed link that expires
  after 10 minutes.
- Files are deleted automatically: unpaid uploads after 2 hours, printed files
  30 minutes after printing, failed jobs after 48 hours.
- A customer can delete their own file at any time from their order's status
  page. This works from the phone that placed the order, or with the full
  Razorpay payment ID. An order that is paid but not yet printed must be
  cancelled and refunded by the shop first.
- Consent is recorded when an order is created, and the customer sees the
  retention periods before choosing a file.
- Every time a print agent downloads a file it is written to an access log,
  and every status change of an order is written to a history table. The owner
  can read both for any order.
