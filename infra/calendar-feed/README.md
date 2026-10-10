# Putting the calendar feed online (AWS Lambda)

The calendar feed (`services/calendar-feed`) runs in **AWS Lambda** behind a **Function URL**:
a public `https://….lambda-url.<region>.on.aws` address that calendar apps can reach.
GitHub Actions builds, tests and deploys it whenever its code changes on `main`.

```
Phone calendar ──hourly──> Function URL ──> Lambda (C#, .NET 10, arm64) ──> Supabase
                                               ^
GitHub Actions (main) ──OIDC, no stored keys──┘
```

**Cost:** Lambda's free tier covers 1 million requests a month. A calendar checking once an
hour is about 720 requests a month per owner, so hundreds of owners stay at $0.

You do this setup once, in four parts. About 15 minutes.

---

## 1. AWS account and region

1. Sign in to the AWS console (create a free account at aws.amazon.com if you don't have one).
2. Top right, pick the region **US East (Ohio) us-east-2**. It's the closest to Indiana.
   Everything below happens in that region.
3. Recommended: **Billing and Cost Management > Budgets > Create budget > Zero spend budget**,
   so AWS emails you if anything ever costs money.

## 2. Create the permissions (CloudFormation)

`aws-setup.yaml` in this folder creates two roles and a log group. It creates no servers and
costs nothing.

1. Open **CloudFormation > Create stack > With new resources (standard)**.
2. **Upload a template file**, choose `infra/calendar-feed/aws-setup.yaml` from your
   Grassroots folder, then **Next**.
3. Stack name: `grassroots-calendar-feed`. Leave the parameters as they are, unless step 6
   below tells you otherwise. **Next**, **Next**.
4. At the bottom, tick **I acknowledge that AWS CloudFormation might create IAM resources**,
   then **Submit**.
5. Wait for **CREATE_COMPLETE** (about a minute; press the refresh button).
6. If it fails with "Provider with url https://token.actions.githubusercontent.com already
   exists": delete the stack, create it again, and set **CreateGitHubOidcProvider** to `false`.
7. Open the **Outputs** tab. Keep it open for the next part.

What the two roles allow:

| Role | Can do | Can't do |
|---|---|---|
| LambdaRole (the function) | Write its own logs | Anything else in your AWS account |
| DeployRole (GitHub Actions) | Create and update the one function named `grassroots-calendar-feed` | Touch anything else. Only the `main` branch of `d0lawuyi/Grassroots` can use it. |

## 3. Tell GitHub about it

In the Grassroots repo on GitHub: **Settings > Secrets and variables > Actions**.

1. **Variables** tab > **New repository variable**, three times, copying from the Outputs tab:

   | Name | Value |
   |---|---|
   | `AWS_REGION` | the `AwsRegion` output (`us-east-2`) |
   | `AWS_DEPLOY_ROLE_ARN` | the `DeployRoleArn` output |
   | `AWS_LAMBDA_ROLE_ARN` | the `LambdaRoleArn` output |

   These aren't secret: they're names, not keys.
2. **Secrets** tab: check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are there (you added
   them for the scheduled tools). The deploy hands them to the function as settings.

## 4. Deploy

1. **Actions > Deploy calendar feed > Run workflow > Run workflow** (branch `main`).
2. After about two minutes it turns green. Open the run: the summary at the top shows
   **Base URL**, like `https://abc123.lambda-url.us-east-2.on.aws`.
3. Check it: open `<Base URL>/health` in your browser. It should say `ok`.
4. Your test calendar now works from anywhere: `<Base URL>/feeds/<your token>.ics`.

From now on, any change to `services/calendar-feed` merged into `main` deploys itself, but
only after the tests pass.

## 5. Turn on the button in the app

1. In the app's `.env` (the main Grassroots folder), add a line with the Base URL:
   ```
   EXPO_PUBLIC_CALENDAR_FEED_URL=https://abc123.lambda-url.us-east-2.on.aws
   ```
2. Restart Expo with the cache cleared: `npx expo start -c`.
3. On your phone, with the account that owns a verified venue: **Profile > Venues >
   Add bookings to my calendar**.
   - **iPhone** opens Calendar's **Subscribe** screen. Tap **Subscribe**.
   - **Android** opens the share sheet with the link. Google Calendar adds links on the web:
     calendar.google.com > **Other calendars** > **+** > **From URL**.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| The deploy run says "Skipped: finish the one-time AWS setup" | One of the three variables or two secrets is missing or misspelled. |
| "Not authorized to perform sts:AssumeRoleWithWebIdentity" | The run wasn't on `main`, or `AWS_DEPLOY_ROLE_ARN` has a typo. |
| `/health` answers `403 Forbidden` | Lambda > `grassroots-calendar-feed` > **Configuration > Permissions > Resource-based policy statements > Add permissions** > **Function URL**, Auth type **NONE**. Save, then add a second one: **AWS account**, Principal `*`, Action `lambda:InvokeFunction`. |
| `/health` answers `500` | Lambda > the function > **Monitor > View CloudWatch logs**. A message about `SUPABASE_` means a secret is missing. |
| Calendar never updates | Calendar apps decide when to check; Apple's default can be hourly or longer. On iPhone, the refresh setting is under the Calendar settings, in Accounts > Fetch New Data. |

To remove everything: delete the Lambda function `grassroots-calendar-feed`, then delete the
`grassroots-calendar-feed` stack in CloudFormation.
