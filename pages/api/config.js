import { getBaseUrl } from '@/lib/baseUrl';

export default function handler(req, res) {
  return res.status(200).json({ baseUrl: getBaseUrl(req) });
}
