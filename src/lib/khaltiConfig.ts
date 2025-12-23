const axios = require('axios');

export async function verifyKhaltiPayment(pidx: string) {
  try {
    let headersList = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
    };

    let bodyContent = JSON.stringify({
      pidx,
    });

    let reqOptions = {
      url: `${process.env.KHALTI_GATEWAY_URL}/api/v2/epayment/lookup/`,
      method: 'POST',
      headers: headersList,
      data: bodyContent,
    };

    let response = await axios.request(reqOptions);
    return response.data;
  } catch (error) {
    throw (error as any).response.data;
  }
}

export async function initializeKhaltiPayment({
  amount,
  purchaseOrderId,
  purchaseOrderName,
  returnUrl,
  websiteUrl,
}: {
  amount: number;
  purchaseOrderId: string;
  purchaseOrderName: string;
  returnUrl: string;
  websiteUrl: string;
}) {
  try {
    let headersList = {
      Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json',
    };

    const bodyContent = {
      return_url: returnUrl,
      website_url: websiteUrl,
      amount: amount,
      purchase_order_id: purchaseOrderId,
      purchase_order_name: purchaseOrderName,
    };

    let reqOptions = {
      url: `${process.env.KHALTI_GATEWAY_URL}/api/v2/epayment/initiate/`,
      method: 'POST',
      headers: headersList,
      data: bodyContent,
    };

    let response = await axios.request(reqOptions);
    return response.data;
  } catch (error) {
    throw (error as any).response.data;
  }
}
