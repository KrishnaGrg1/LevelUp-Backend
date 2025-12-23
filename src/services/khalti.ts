// import axios from 'axios';

// async function initializeKhaltiPayment(details: Record<string, unknown>) {
//   console.log('Khalti Secret Key:', process.env.KHALTI_SECRET_KEY);

//   const headersList = {
//     Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
//     'Content-Type': 'application/json',
//   };

//   const bodyContent = JSON.stringify(details);
//   console.log(bodyContent);
//   const reqOptions = {
//     url: `${process.env.KHALTI_GATEWAY_URL}api/v2/epayment/initiate/`,
//     method: 'POST',
//     headers: headersList,
//     data: bodyContent,
//   };

//   try {
//     const response = await axios.request(reqOptions);

//     console.log(response.data);
//     return response.data;
//   } catch (e) {
//     console.error('Error initializing Khalti payment:', e);
//     throw e;
//   }
// }

// async function verifyPayment(pidx: string) {
//   const headersList = {
//     Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
//     'Content-Type': 'application/json',
//   };
//   const bodyContent = JSON.stringify({ pidx });

//   const reqOptions = {
//     url: `${process.env.KHALTI_GATEWAY_URL}api/v2/epayment/lookup/`,
//     method: 'POST',
//     headers: headersList,
//     data: bodyContent,
//   };
//   try {
//     const response = await axios.request(reqOptions);
//     return response.data;
//   } catch (error) {
//     console.error('Error verifying Khalti payment:', error);
//     throw error;
//   }
// }

// const khaltifunction = {
//   initializeKhaltiPayment,
//   verifyPayment,
// };

// export default khaltifunction;
