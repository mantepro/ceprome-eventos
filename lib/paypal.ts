const BASE_URL =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`)
  const json = await res.json()
  return json.access_token as string
}

export async function createPayPalOrder(params: {
  amount: number
  currency: string
  description: string
  returnUrl: string
  cancelUrl: string
}): Promise<{ orderId: string; approvalUrl: string }> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: params.currency,
            value: params.amount.toFixed(2),
          },
          description: params.description,
        },
      ],
      application_context: {
        brand_name: 'CEPROME',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PayPal create order failed: ${err}`)
  }

  const order = await res.json()
  const approvalUrl = (order.links as { rel: string; href: string }[]).find(
    (l) => l.rel === 'approve'
  )?.href

  if (!approvalUrl) throw new Error('PayPal approval URL not found')

  return { orderId: order.id as string, approvalUrl }
}

export async function capturePayPalOrder(orderId: string): Promise<{
  status: string
  amount: number
  currency: string
}> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PayPal capture failed: ${err}`)
  }

  const order = await res.json()
  const capture = (
    order.purchase_units as {
      payments: { captures: { amount: { value: string; currency_code: string } }[] }
    }[]
  )?.[0]?.payments?.captures?.[0]

  return {
    status: order.status as string,
    amount: parseFloat(capture?.amount?.value ?? '0'),
    currency: capture?.amount?.currency_code ?? 'USD',
  }
}
