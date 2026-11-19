import { Router } from 'express';
import { Certificate } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap, notFound } from '../utils/http.js';
import { certificateView } from '../utils/serialize.js';
import { writeCertificatePdf } from '../services/certificatePdf.js';

const router = Router();

router.get('/', requireAuth, wrap(async (req, res) => {
  const certs = await Certificate.find({ user: req.user._id }).sort({ issuedAt: -1 });
  res.json({ items: certs.map(certificateView) });
}));

/** Public verification: anyone holding the certificate ID can confirm it is genuine. */
router.get('/verify/:code', wrap(async (req, res) => {
  const cert = await Certificate.findOne({ code: String(req.params.code).toUpperCase() });
  if (!cert) throw notFound('No certificate matches this ID.');
  res.json({ certificate: certificateView(cert) });
}));

/** The PDF is generated on demand. The ID is unguessable, so the link itself is the credential. */
router.get('/:code/pdf', wrap(async (req, res) => {
  const cert = await Certificate.findOne({ code: String(req.params.code).toUpperCase() });
  if (!cert) throw notFound('No certificate matches this ID.');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="homeroom-certificate-${cert.code}.pdf"`);
  writeCertificatePdf(cert, res);
}));

export default router;
