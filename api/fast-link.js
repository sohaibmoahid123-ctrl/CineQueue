module.exports = async (req, res) => {
  const targetLink = req.query.link;

  if (!targetLink || !targetLink.startsWith('http')) {
    return res.status(400).json({ error: 'Valid link is required' });
  }

  return res.status(200).json({ success: true, url: targetLink });
};
