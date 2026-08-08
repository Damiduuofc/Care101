import Client from 'android-sms-gateway';

const test = (name, baseUrlValue) => {
  try {
    const client = new Client('login', 'password', undefined, baseUrlValue);
    console.log(`${name}: client.baseUrl is [${client.baseUrl}], type: ${typeof client.baseUrl}`);
  } catch (e) {
    console.log(`${name}: Error:`, e.message);
  }
};

test("Passed undefined", undefined);
test("Passed empty string", "");
test("Passed baseUrl || undefined when baseUrl is empty string", "" || undefined);
test("Passed baseUrl || undefined when baseUrl is undefined", undefined || undefined);
test("Passed baseUrl || undefined when baseUrl is null", null || undefined);
