import { ProxyAgent } from 'proxy-agent';

// List of proxies (replace with your own)
const PROXY_LIST = [
  'http://user:pass@proxy1.example.com:8080',
  'http://user:pass@proxy2.example.com:8080',
  // Add more proxies
];

let currentProxyIndex = 0;

export function getProxy() {
  const proxy = PROXY_LIST[currentProxyIndex];
  // Rotate proxies
  currentProxyIndex = (currentProxyIndex + 1) % PROXY_LIST.length;
  return proxy;
}

export function createProxyAgent() {
  const proxy = getProxy();
  console.log(`Using proxy: ${proxy.replace(/\/\/.*?@/, '//****:****@')}`);
  return new ProxyAgent(proxy);
}
