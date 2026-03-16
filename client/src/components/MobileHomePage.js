/**
 * TikTok-Style Mobile Home Page
 * 
 * A clean, immersive landing experience:
 * - Full-screen hero with animated gradient
 * - Swipeable feature cards
export default MobileHomePage;
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        opacity: 0.5,
      }}
    />
  </Box>
);

// Feature highlight card
const FeatureCard = ({ icon: Icon, title, description, color }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      p: 2,
      borderRadius: 2,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(10px)',
    }}
  >
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${color}15`,
        border: `1px solid ${color}30`,
      }}
    >
      <Icon sx={{ color, fontSize: 24 }} />
    </Box>
    <Box>
      <Typography
        sx={{
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.95rem',
          fontFamily: '"Outfit", sans-serif',
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.8rem',
          fontFamily: '"Outfit", sans-serif',
        }}
      >
        {description}
      </Typography>
    </Box>
  </Box>
);

// Floating profile avatars for social proof
const FloatingAvatars = () => {
  const avatars = [
    { top: '15%', left: '8%', delay: 0, size: 40 },
    { top: '25%', right: '10%', delay: 0.5, size: 36 },
    { top: '40%', left: '5%', delay: 1, size: 32 },
    { top: '55%', right: '8%', delay: 1.5, size: 38 },
  ];

  return (
    <>
      {avatars.map((avatar, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            top: avatar.top,
            left: avatar.left,
            right: avatar.right,
            zIndex: 5,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: avatar.delay, duration: 0.5 }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Avatar
              sx={{
                width: avatar.size,
                height: avatar.size,
                bgcolor: `hsl(${160 + i * 40}, 70%, 50%)`,
                border: '2px solid rgba(255,255,255,0.2)',
                fontSize: avatar.size * 0.4,
              }}
            >
              {String.fromCharCode(65 + i)}
            </Avatar>
          </motion.div>
        </motion.div>
      ))}
    </>
  );
};

const MobileHomePage = () => {
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [infoPage, setInfoPage] = useState(0);
  
  const features = [
    { icon: Verified, title: 'Verified Profiles', description: 'ID-verified companions', color: '#00f2ea' },
    { icon: Shield, title: 'Secure & Private', description: 'End-to-end encryption', color: '#4ade80' },
    { icon: Lock, title: 'Escrow Payments', description: 'Protected transactions', color: '#ffd700' },
    { icon: Speed, title: 'Instant Match', description: 'AI-powered matching', color: '#ff0055' },
  ];

  const trustPillars = [
    { icon: Verified, title: 'KYC-Verified Profiles', value: 'Identity + selfie checks' },
    { icon: Lock, title: 'Private Messaging', value: 'Encrypted chat & calls' },
    { icon: Shield, title: 'Safety Layer', value: 'Fraud and abuse protection' },
  ];

  const howItWorks = [
    'Browse verified profiles nearby',
    'Message and confirm details safely',
    'Book with confidence and rate experience',
  ];

  // Auto-cycle features
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [features.length]);
  // Auto-advance info panel every 6 seconds
  useEffect(() => {
    const t = setInterval(() => setInfoPage((p) => (p + 1) % 2), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: '100vw', // CRITICAL: Prevent overflow
        minHeight: '100vh',
        // Ensure content can be scrolled
        overflow: 'visible',
        overflowX: 'hidden', // CRITICAL: Prevent horizontal scroll
        pb: '80px', // Space for bottom nav
        boxSizing: 'border-box',
      }}
    >
      {/* Video Showcase - At the Very Top */}
      <VideoShowcase />
      
      {/* Content Section with Background */}
      <Box
        sx={{
          position: 'relative',
          minHeight: '100vh',
        }}
      >
        <AnimatedBackground />
        <FloatingAvatars />
      
      {/* Main Content */}
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          px: 3,
          zIndex: 10,
          pt: 4,
          pb: 2,
          gap: 2,
        }}
      >
        {/* Live Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Chip
            icon={<Circle sx={{ fontSize: '8px !important', color: '#4ade80 !important' }} />}
            label="Live • 2.4k+ online now"
            size="small"
            sx={{
              bgcolor: 'rgba(74,222,128,0.1)',
              color: '#4ade80',
              border: '1px solid rgba(74,222,128,0.3)',
              fontWeight: 600,
              fontSize: '0.75rem',
              mb: 3,
              alignSelf: 'flex-start',
              '& .MuiChip-icon': {
                animation: 'pulse 2s infinite',
              },
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
        </motion.div>

        {/* Hero Text */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Typography
            sx={{
              fontSize: '2.5rem',
              fontWeight: 900,
              lineHeight: 1.1,
              fontFamily: '"Outfit", sans-serif',
              background: 'linear-gradient(135deg, #fff 0%, #00f2ea 50%, #ff0055 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1.5,
            }}
          >
            Premium
            <br />
            Connections
          </Typography>
          
          <Typography
            sx={{
              fontSize: '1rem',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: '"Outfit", sans-serif',
              lineHeight: 1.5,
              mb: 4,
              maxWidth: 280,
            }}
          >
            Verified companions. Secure platform. 
            Real connections.
          </Typography>
        </motion.div>

        {/* Feature Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <FeatureCard {...features[currentSlide]} />
            </motion.div>
          </AnimatePresence>
          
          {/* Carousel Dots */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'center' }}>
            {features.map((_, i) => (
              <Box
                key={i}
                onClick={() => setCurrentSlide(i)}
                sx={{
                  width: i === currentSlide ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: i === currentSlide ? '#00f2ea' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>
        </motion.div>

        {/* Informative trust pillars */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62 }}
        >
          <Typography
            sx={{
              color: '#d7fff9',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              mb: 1,
              fontFamily: '"Outfit", sans-serif',
            }}
          >
            Why Zerohook is safer
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.1 }}>
            {trustPillars.map((item) => (
              <Box
                key={item.title}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.2,
                  p: 1.2,
                  borderRadius: '12px',
                  background: 'rgba(10, 14, 18, 0.45)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <item.icon sx={{ fontSize: 18, color: '#00f2ea' }} />
                <Box>
                  <Typography sx={{ color: '#fff', fontSize: '0.82rem', fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.74rem', fontFamily: '"Outfit", sans-serif' }}>
                    {item.value}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </motion.div>

        {/* Informative steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72 }}
        >
          <Typography
            sx={{
              color: '#ffd8e8',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              mb: 1,
              fontFamily: '"Outfit", sans-serif',
            }}
          >
            How it works
          </Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {howItWorks.map((step, index) => (
              <Box
                key={step}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontFamily: '"Outfit", sans-serif',
                }}
              >
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#041215',
                    bgcolor: '#00f2ea',
                    boxShadow: '0 0 12px rgba(0,242,234,0.35)',
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.86)', fontSize: '0.8rem', fontFamily: '"Outfit", sans-serif' }}>
                  {step}
                </Typography>
              </Box>
            ))}
          </Box>
        </motion.div>
      </Box>

      {/* Bottom CTA Section */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 10,
          px: 3,
          pb: 3,
          pt: 2,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
        }}
      >
        {!isAuthenticated ? (
          <>
            {/* Primary CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Button
                fullWidth
                onClick={() => navigate('/register')}
                sx={{
                  py: 1.75,
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '1rem',
                  fontFamily: '"Outfit", sans-serif',
                  textTransform: 'none',
                  boxShadow: '0 8px 32px rgba(0,242,234,0.3)',
                  mb: 1.5,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)',
                    boxShadow: '0 12px 40px rgba(0,242,234,0.4)',
                  },
                }}
                endIcon={<ArrowForward />}
              >
                Get Started
              </Button>
            </motion.div>
            
            {/* Secondary CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Button
                fullWidth
                onClick={() => navigate('/login')}
                sx={{
                  py: 1.5,
                  borderRadius: '14px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  fontFamily: '"Outfit", sans-serif',
                  textTransform: 'none',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.05)',
                    {/* ── Swipeable info panel: swipe or tap dots to switch between pages ── */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.62 }}
                      style={{ overflow: 'hidden', position: 'relative' }}
                    >
                      <motion.div
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.18}
                        onDragEnd={(_, info) => {
                          if (info.offset.x < -40) setInfoPage(1);
                          else if (info.offset.x > 40) setInfoPage(0);
                        }}
                        style={{ cursor: 'grab', touchAction: 'pan-y' }}
                      >
                        <AnimatePresence mode="wait">
                          {infoPage === 0 ? (
                            <motion.div
                              key="trust"
                              initial={{ opacity: 0, x: 32 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -32 }}
                              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                            >
                              <Typography sx={{ color: '#d7fff9', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1, fontFamily: '"Outfit", sans-serif' }}>
                                Why Zerohook is safer
                              </Typography>
                              <Box sx={{ display: 'grid', gap: 1.1 }}>
                                {trustPillars.map((item) => (
                                  <Box key={item.title} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, p: 1.2, borderRadius: '12px', background: 'rgba(10,14,18,0.45)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(10px)' }}>
                                    <item.icon sx={{ fontSize: 18, color: '#00f2ea' }} />
                                    <Box>
                                      <Typography sx={{ color: '#fff', fontSize: '0.82rem', fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>{item.title}</Typography>
                                      <Typography sx={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.74rem', fontFamily: '"Outfit", sans-serif' }}>{item.value}</Typography>
                                    </Box>
                                  </Box>
                                ))}
                              </Box>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="howItWorks"
                              initial={{ opacity: 0, x: 32 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -32 }}
                              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                            >
                              <Typography sx={{ color: '#ffd8e8', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1, fontFamily: '"Outfit", sans-serif' }}>
                                How it works
                              </Typography>
                              <Box sx={{ display: 'grid', gap: 1 }}>
                                {howItWorks.map((step, index) => (
                                  <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#041215', bgcolor: '#00f2ea', boxShadow: '0 0 12px rgba(0,242,234,0.35)', flexShrink: 0 }}>{index + 1}</Box>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.86)', fontSize: '0.8rem', fontFamily: '"Outfit", sans-serif' }}>{step}</Typography>
                                  </Box>
                                ))}
                              </Box>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                      {/* Page indicator dots */}
                      <Box sx={{ display: 'flex', gap: 0.8, mt: 1.5, justifyContent: 'center' }}>
                        {[0, 1].map((i) => (
                          <Box key={i} onClick={() => setInfoPage(i)} sx={{ width: i === infoPage ? 18 : 7, height: 7, borderRadius: 4, bgcolor: i === infoPage ? '#00f2ea' : 'rgba(255,255,255,0.28)', transition: 'all 0.3s ease', cursor: 'pointer' }} />
                        ))}
                      </Box>
                    </motion.div>
              ) : (
                <motion.div
                  key="howItWorks"
                  initial={{ opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -32 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                >
                  <Typography sx={{ color: '#ffd8e8', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1, fontFamily: '"Outfit", sans-serif' }}>
                    How it works
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    {howItWorks.map((step, index) => (
                      <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#041215', bgcolor: '#00f2ea', boxShadow: '0 0 12px rgba(0,242,234,0.35)', flexShrink: 0 }}>{index + 1}</Box>
                        <Typography sx={{ color: 'rgba(255,255,255,0.86)', fontSize: '0.8rem', fontFamily: '"Outfit", sans-serif' }}>{step}</Typography>
                      </Box>
                    ))}
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Page indicator dots */}
          <Box sx={{ display: 'flex', gap: 0.8, mt: 1.5, justifyContent: 'center' }}>
            {[0, 1].map((i) => (
              <Box
                key={i}
                onClick={() => setInfoPage(i)}
                sx={{
                  width: i === infoPage ? 18 : 7,
                  height: 7,
                  borderRadius: 4,
                  bgcolor: i === infoPage ? '#00f2ea' : 'rgba(255,255,255,0.28)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>
        </motion.div>
