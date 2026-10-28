# Pastry Project requirements traceability

This matrix maps the stated project objectives to implemented system evidence.
It distinguishes software evidence from research evidence so that the project
does not claim interviews, surveys, or user acceptance results that were not
actually conducted.

| Objective | Implementation evidence | Current status | Evidence still needed |
|---|---|---|---|
| 1.1 Manual order, inventory, and communication difficulties | Digital ordering, inventory, chat, notifications, and analytics replace manual steps. | Partially evidenced | Interview, observation, or survey results from the owner/admin and customers. |
| 1.2 Pre-order, rush, and standard workflows | `order_type`, pickup/delivery dates, rush fee, order statuses, payment states, and customized order flow. | Met | End-to-end user acceptance scenarios. |
| 1.3 Sales, production, and ingredient allocation deficiencies | Reports, forecasting, recipe consumption, low-stock alerts, procurement recommendations, and waste analytics. | Met | Baseline-versus-system comparison using real operating records. |
| 1.4 Functional and non-functional requirements | Web roles, API authorization, database services, responsive UI, analytics, chat, and automated tests. | Partially evidenced | Approved requirements specification and stakeholder sign-off. |
| 2.1 Responsive web application | React customer and admin applications with responsive layouts and production builds. | Met | Browser/device acceptance checklist. |
| 2.2 Role-based access control | Protected admin routes and backend role checks for customer/admin endpoints. | Met | Authorization test report for every protected route. |
| 2.3 Centralized database | Orders, users, products, ingredients, batches, movements, waste, sales history, messages, and realtime events. | Met | ERD/database diagram and migration inventory. |
| 2.4 Business Analytics | Sales, cake, inventory, waste, order, diagnostic, and prescriptive views in Reports, Dashboard, and Predictive Analytics. | Met | Data completeness and calculation validation report. |
| 2.5 In-app chat | Customer and staff chat screens and customer/staff message APIs. | Met | Customer-admin communication acceptance scenario. |
| 3.1 Centralized repository | Laravel services and database-backed APIs for operational records. | Met | Backup, recovery, and data-retention evidence. |
| 3.2 Customized cake workflow | Customer request, admin review, quote, downpayment, payment proof, and approval statuses. | Met | Full customized-order acceptance test. |
| 3.3 Inventory tracking | Batch stock-in/out, expiry dates, low-stock thresholds, discard approval, waste logs, and synchronization. | Met | Physical stock reconciliation test. |
| 3.4 Customer-admin synchronization | Realtime event publisher, SSE stream, client subscription, and polling fallback. | Mostly met | Live two-browser test under a deployed environment. Automated publisher tests are included. |
| 3.5 Dashboards and forecasts | Interactive reports, dashboard charts, demand forecast methods, rolling backtesting, and production recommendations. | Met | Forecast validation report using an approved dataset. |

## Interpretation

The implementation objectives are substantially covered. Objectives 1.1 and
1.4 cannot be completed by code alone because they require stakeholder research
and formal approval. Objective 3.4 has automated server-side coverage, but its
final claim should also include a live two-user acceptance test.
