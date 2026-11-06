# DevSphere user guide

## 1. Create your workspace

1. Open DevSphere and select **Get started**.
2. Register with your name, email, and a password.
3. Complete the onboarding steps: name the workspace, choose your role/industry, and select a workflow.
4. Start from **Overview**. Use **Projects** to create a project and **My tasks** to break it into clear next steps.

## 2. Find your way around

- **Overview** summarizes project and task activity.
- **My tasks** shows assigned work; update status as work moves through the board.
- **Projects** opens project details and the tasks belonging to each project.
- **Messages** and **Calendar** keep team conversations and scheduled work together.
- **Community** and **Blog & news** contain discussions and platform updates.
- **Groups** creates focused spaces for classes, clients, and shared interests; the number of groups depends on your plan.
- **Extensions** installs curated tools; some extensions require Pro or Business.
- **Study hub** supports study planning and learning resources.
- **Files & folders** stores workspace documents and source code.
- **Code studio** edits saved source files and previews HTML/HTM files in an isolated browser frame.
- **Help & support** has the in-app quick start, storage, plan, and payment guide.
- **Pricing** shows the active plan, usage, payment history, and cancellation controls.

Use the **Pro** button in the workspace heading to open Pricing. The top-left search field can also jump between workspace sections.

## 3. Work with files and code

1. Open **Files & folders** and create a folder or upload a supported file.
2. Open folders by selecting their names; use the breadcrumbs or parent-folder button to navigate back.
3. Use the code icon beside a source file to open it in **Code studio**.
4. Edit the filename/content and select **Save to files**. The saved version replaces the opened file and remains available from Files & folders.
5. Select **Run preview** for an `.html` or `.htm` file. The preview runs in a sandboxed iframe; JavaScript and other source languages are not executed as server programs.
6. Select the download icon to save an accessible file locally.

Deleting a folder deletes its contained files as well. Download a backup first if you need to preserve any content.

## 4. Plans and feature limits

### Free

- 5 GB storage
- 5 projects and 100 tasks
- 3 workspace members, including pending invitations
- 3 groups
- 250 files and 50 folders
- 10 AI assistant requests per day
- Core projects, tasks, calendar, messages, study hub, community, and file tools

### Pro

- 100 GB storage
- 100 projects, 5,000 tasks, and 10 members
- 10,000 files and 1,000 folders
- 25 groups
- 500 AI requests per day
- Unlocks AI assistant, whiteboard, huddles/video calls, and contract drafts

### Business

- 1 TB storage
- 500 projects, 25,000 tasks, and 50 members
- 100,000 files and 10,000 folders
- 100 groups
- 5,000 AI requests per day
- Includes Pro tools and unlocks analytics and CRM

Limits are enforced by the backend, so a hidden/disabled button is not the security boundary. Existing files are retained if a subscription expires or is cancelled; new writes and gated operations follow the current plan limits. Deleting files frees storage. Storage uses binary units (GiB/TiB) while the interface labels them GB/TB for readability.

## 5. Purchase or cancel a plan

1. Select **Pro** in the heading or open **Pricing** in the sidebar.
2. Select USD for Stripe card checkout or GHS for Paystack card/mobile-money checkout.
3. Select a paid plan and continue to the provider's secure payment page.
4. Return to DevSphere. The Pricing page checks payment status; plan access becomes active after the backend receives and verifies the provider webhook.
5. Review the current plan and payment history on the same page. Select **Cancel plan** to schedule cancellation.

USD plans renew monthly. GHS plans provide 30 days and require manual renewal. A workspace can have only one paid subscription at a time; it must be cancelled and reach the end of its paid period before another plan can be purchased. Available payment methods depend on the merchant account and provider configuration. If checkout says a provider is not configured, ask the workspace administrator to configure backend-only test/live credentials.

## 6. What to do when something is blocked

- **Storage/file/folder/project/task/member/group cap:** remove unneeded data or choose a paid plan with a higher limit.
- **AI daily allowance:** wait until the daily reset or upgrade for a larger allowance.
- **Pro feature:** choose Pro or Business on Pricing.
- **Business feature (Analytics or CRM):** choose Business.
- **Payment still processing:** keep the reference from checkout, refresh Billing activity, and confirm the provider webhook endpoint is configured. Do not retry repeatedly until you verify whether the first payment succeeded.

## 7. Privacy and good practices

- Only upload files you are authorized to store and share.
- Review generated contract drafts with a qualified legal professional; they are not legal advice.
- Do not put passwords, payment keys, or private credentials in code files, messages, or community posts.
- Before deleting a project or folder, download anything you need to keep.
