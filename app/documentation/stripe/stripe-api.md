# API Reference

The Stripe API is organized around [REST](http://en.wikipedia.org/wiki/Representational_State_Transfer.md). Our API has predictable resource-oriented URLs, accepts [form-encoded](https://en.wikipedia.org/wiki/POST_\(HTTP\)#Use_for_submitting_web_forms.md) request bodies, returns [JSON-encoded](http://www.json.org/.md) responses, and uses standard HTTP response codes, authentication, and verbs.

You can use the Stripe API in test mode, which doesn’t affect your live data or interact with the banking networks. The API key you use to [authenticate](https://docs.stripe.com/api/authentication.md) the request determines whether the request is live mode or test mode.

The Stripe API doesn’t support bulk updates. You can work on only one object per request.

The Stripe API differs for every account as we release new [versions](https://docs.stripe.com/api/versioning.md) and tailor functionality. 

## Just getting started?

Check out our [development quickstart](https://docs.stripe.com/development/quickstart.md) guide.

## Not a developer?

Use Stripe’s [no-code options](https://docs.stripe.com/payments/no-code.md) or apps from [our partners](https://stripe.partners/.md) to get started with Stripe and to do more with your Stripe account—no code required.

### Base URL

```plaintext
https://api.stripe.com
```