import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser } from '../store/slices/authSlice';
import {
  Box,
  Container,
  Typography,
  Divider,
  FormControlLabel,
  Checkbox,
  Grid,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Alert,
  LinearProgress,
  Tooltip,
  IconButton,
  useMediaQuery,
} from '@mui/material';
import {
  Lock,
  Person,
  Email,
  PersonAdd,
  Cake,
  Wc,
  VerifiedUser,
  Diamond,
  Star,
  InfoOutlined,
  ArrowBack,
  ArrowForward,
  SaveOutlined,
  RestartAlt,
  CheckCircleOutline,
  AdminPanelSettings,
  Refresh,
  DeleteOutline,
} from '@mui/icons-material';
import { GlassCard, GlassButton, GlassInput } from '../components/ui';
import apiClient from '../services/apiClient';

const AFRICAN_COUNTRIES = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', phoneCode: '+234' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', phoneCode: '+233' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', phoneCode: '+254' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', phoneCode: '+27' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', phoneCode: '+256' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', phoneCode: '+255' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', phoneCode: '+250' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', phoneCode: '+267' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', phoneCode: '+260' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', phoneCode: '+265' },
];

const REGISTRATION_DRAFT_STORAGE_KEY = 'zerohook-registration-draft-v2';
const REGISTRATION_ANALYTICS_STORAGE_KEY = 'zerohook-registration-analytics-v2';

const WIZARD_STEPS = [
  {
    id: 0,
    title: 'Personal Information',
    shortLabel: 'Personal',
    requiredFields: ['firstName', 'lastName', 'gender', 'dateOfBirth'],
  },
  {
    id: 1,
    title: 'Contact Details',
    shortLabel: 'Contact',
    requiredFields: ['email', 'phone'],
  },
  {
    id: 2,
    title: 'Account Setup',
    shortLabel: 'Setup',
    requiredFields: ['accountType', 'password', 'confirmPassword'],
  },
  {
    id: 3,
    title: 'Verification & Terms',
    shortLabel: 'Terms',
    requiredFields: ['agreeTerms'],
  },
];

const ACCOUNT_TYPE_LABELS = {
  client: 'Clients',
  provider: 'Providers',
  sugar_daddy: 'Sugar Daddy',
  sugar_mommy: 'Sugar Mommy',
};

const FIELD_LABEL_MAP = {
  firstName: 'First Name',
  lastName: 'Last Name',
  gender: 'Gender',
  dateOfBirth: 'Date of Birth',
  email: 'Email',
  phone: 'Phone Number',
  accountType: 'Account Type',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  agreeTerms: 'Terms Agreement',
};

const EMPTY_DEBUG_SUMMARY = {
  stepViews: 0,
  submitAttempts: 0,
  completed: 0,
  abandoned: 0,
};

const EMPTY_REGISTRATION_DEBUG_STATS = {
  eventCount: 0,
  lastUpdated: '',
  desktopTopFields: [],
  mobileTopFields: [],
  desktopSummary: { ...EMPTY_DEBUG_SUMMARY },
  mobileSummary: { ...EMPTY_DEBUG_SUMMARY },
};

const VALIDATION_ORDER = [
  'firstName',
  'lastName',
  'gender',
  'dateOfBirth',
  'email',
  'phone',
  'accountType',
  'password',
  'confirmPassword',
  'agreeTerms',
];

const summarizeDraftTimestamp = (savedAt) => {
  if (!savedAt) {
    return '';
  }

  const parsed = new Date(savedAt);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleString();
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { loading, error: authError } = useSelector((state) => state.auth);
  const authUser = useSelector((state) => state.auth.user);
  const isMobile = useMediaQuery('(max-width:600px)');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    accountType: '',
    gender: '',
    dateOfBirth: '',
    faceVerificationConsent: false,
    agreeTerms: false,
  });
  const [localError, setLocalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedCountry, setSelectedCountry] = useState(AFRICAN_COUNTRIES[0]);
  const [detectingLocation, setDetectingLocation] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [statusNotice, setStatusNotice] = useState({ type: 'info', message: '' });
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState('');
  const [registrationDebugStats, setRegistrationDebugStats] = useState(EMPTY_REGISTRATION_DEBUG_STATS);

  const formRef = useRef(null);
  const errorRef = useRef(null);
  const bottomErrorRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const registrationSessionIdRef = useRef(`reg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const startedFieldsRef = useRef(new Set());
  const registrationCompletedRef = useRef(false);
  const currentStepRef = useRef(0);
  const formProgressRef = useRef(0);
  const completedRequiredFieldsRef = useRef(0);
  const viewportRef = useRef(isMobile ? 'mobile' : 'desktop');

  const totalSteps = WIZARD_STEPS.length;
  const isLastStep = currentStep === totalSteps - 1;

  const isAdminUser = useMemo(() => {
    if (
      authUser?.is_admin === true
      || authUser?.role === 'admin'
      || authUser?.isAdmin === true
      || authUser?.profile_data?.accountType === 'admin'
    ) {
      return true;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token || token.split('.').length < 2) {
        return false;
      }

      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.isAdmin === true || payload?.role === 'admin' || payload?.is_admin === true;
    } catch (_) {
      return false;
    }
  }, [authUser]);

  const registrationDebugEnabled = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return params.get('registrationDebug') === '1';
  }, [location.search]);

  const showRegistrationDebugPanel = isAdminUser && registrationDebugEnabled;

  const completionChecks = useMemo(() => ([
    Boolean(formData.firstName.trim()),
    Boolean(formData.lastName.trim()),
    Boolean(formData.gender),
    Boolean(formData.dateOfBirth),
    Boolean(formData.email.trim()),
    Boolean(formData.phone.trim()),
    Boolean(formData.accountType),
    Boolean(formData.password),
    Boolean(formData.confirmPassword),
    Boolean(formData.agreeTerms),
  ]), [formData]);

  const completedRequiredFields = completionChecks.filter(Boolean).length;
  const formProgress = Math.round((completedRequiredFields / completionChecks.length) * 100);

  const resolvePostRegisterDestination = () => {
    const fromState = location.state?.from;

    if (fromState && typeof fromState === 'object') {
      const pathname = fromState.pathname || '/subscription';
      const search = fromState.search || '';
      const hash = fromState.hash || '';

      return {
        pathname: `${pathname}${search}${hash}`,
        state: fromState.state,
      };
    }

    if (typeof fromState === 'string' && fromState.trim()) {
      return { pathname: fromState };
    }

    return { pathname: '/subscription' };
  };

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    formProgressRef.current = formProgress;
  }, [formProgress]);

  useEffect(() => {
    completedRequiredFieldsRef.current = completedRequiredFields;
  }, [completedRequiredFields]);

  useEffect(() => {
    viewportRef.current = isMobile ? 'mobile' : 'desktop';
  }, [isMobile]);

  const appendRegistrationAnalytics = useCallback((eventName, details = {}) => {
    try {
      const existing = JSON.parse(localStorage.getItem(REGISTRATION_ANALYTICS_STORAGE_KEY) || '{}');
      const events = Array.isArray(existing.events) ? existing.events : [];
      const fieldDropoff = existing.fieldDropoff || { desktop: {}, mobile: {} };
      const viewport = viewportRef.current;

      if (eventName === 'field_validation_error' && details.field) {
        const viewportCounts = fieldDropoff[viewport] || {};
        fieldDropoff[viewport] = {
          ...viewportCounts,
          [details.field]: (viewportCounts[details.field] || 0) + 1,
        };
      }

      const eventPayload = {
        eventName,
        sessionId: registrationSessionIdRef.current,
        step: typeof details.step === 'number' ? details.step : currentStepRef.current,
        viewport,
        completionPercent: formProgressRef.current,
        timestamp: new Date().toISOString(),
        ...details,
      };

      localStorage.setItem(
        REGISTRATION_ANALYTICS_STORAGE_KEY,
        JSON.stringify({
          ...existing,
          events: [...events, eventPayload].slice(-500),
          fieldDropoff,
          lastUpdated: eventPayload.timestamp,
        })
      );
    } catch (trackingError) {
      console.debug('Registration analytics tracking skipped:', trackingError);
    }
  }, []);

  const summarizeViewportEvents = useCallback((events, viewport) => {
    const scopedEvents = events.filter((event) => event?.viewport === viewport);
    const countUniqueSessions = (eventName) => {
      const uniqueSessions = new Set(
        scopedEvents
          .filter((event) => event?.eventName === eventName)
          .map((event) => event?.sessionId)
          .filter(Boolean)
      );

      return uniqueSessions.size;
    };

    return {
      stepViews: countUniqueSessions('step_viewed'),
      submitAttempts: countUniqueSessions('registration_submit_attempt'),
      completed: countUniqueSessions('registration_completed'),
      abandoned: countUniqueSessions('registration_abandoned'),
    };
  }, []);

  const loadRegistrationDebugStats = useCallback(() => {
    try {
      const rawAnalytics = localStorage.getItem(REGISTRATION_ANALYTICS_STORAGE_KEY);
      if (!rawAnalytics) {
        setRegistrationDebugStats(EMPTY_REGISTRATION_DEBUG_STATS);
        return;
      }

      const parsed = JSON.parse(rawAnalytics);
      const events = Array.isArray(parsed?.events) ? parsed.events : [];
      const fieldDropoff = parsed?.fieldDropoff || { desktop: {}, mobile: {} };

      const mapTopFields = (fieldCounts) => {
        return Object.entries(fieldCounts || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([field, count]) => ({
            field,
            label: FIELD_LABEL_MAP[field] || field,
            count,
          }));
      };

      setRegistrationDebugStats({
        eventCount: events.length,
        lastUpdated: parsed?.lastUpdated || '',
        desktopTopFields: mapTopFields(fieldDropoff.desktop),
        mobileTopFields: mapTopFields(fieldDropoff.mobile),
        desktopSummary: summarizeViewportEvents(events, 'desktop'),
        mobileSummary: summarizeViewportEvents(events, 'mobile'),
      });
    } catch (error) {
      console.debug('Failed to load registration debug stats:', error);
      setRegistrationDebugStats(EMPTY_REGISTRATION_DEBUG_STATS);
    }
  }, [summarizeViewportEvents]);

  const clearRegistrationDebugStats = () => {
    localStorage.removeItem(REGISTRATION_ANALYTICS_STORAGE_KEY);
    setRegistrationDebugStats(EMPTY_REGISTRATION_DEBUG_STATS);
    setStatusNotice({
      type: 'info',
      message: 'Local registration analytics cleared for this browser.',
    });
  };

  useEffect(() => {
    appendRegistrationAnalytics('step_viewed', {
      stepName: WIZARD_STEPS[currentStep]?.title || 'Unknown step',
    });
  }, [appendRegistrationAnalytics, currentStep]);

  useEffect(() => {
    if (!showRegistrationDebugPanel) {
      return;
    }

    loadRegistrationDebugStats();
  }, [loadRegistrationDebugStats, showRegistrationDebugPanel]);

  useEffect(() => {
    const detectCountry = async () => {
      try {
        const { data } = await apiClient.post('/countries/detect');

        if (data.success && data.detectedCountry) {
          const detected = AFRICAN_COUNTRIES.find((country) => country.code === data.detectedCountry.code);
          if (detected) {
            setSelectedCountry(detected);
          }
        }
      } catch (error) {
        console.debug('Country detection failed, fallback used:', error);
      } finally {
        setDetectingLocation(false);
      }
    };

    detectCountry();
  }, []);

  useEffect(() => {
    try {
      const rawDraft = localStorage.getItem(REGISTRATION_DRAFT_STORAGE_KEY);
      if (!rawDraft) {
        return;
      }

      const parsedDraft = JSON.parse(rawDraft);
      if (!parsedDraft?.formData) {
        return;
      }

      const {
        formData: draftFormData,
        selectedCountryCode,
        currentStep: draftStep,
        savedAt,
      } = parsedDraft;

      setFormData((prev) => ({
        ...prev,
        ...draftFormData,
        password: '',
        confirmPassword: '',
      }));

      if (selectedCountryCode) {
        const matchedCountry = AFRICAN_COUNTRIES.find((country) => country.code === selectedCountryCode);
        if (matchedCountry) {
          setSelectedCountry(matchedCountry);
        }
      }

      if (typeof draftStep === 'number' && draftStep >= 0 && draftStep < totalSteps) {
        setCurrentStep(draftStep);
      }

      setLastDraftSavedAt(savedAt || '');
      setStatusNotice({
        type: 'info',
        message: 'Recovered your saved draft. For security, please re-enter your password before submitting.',
      });

      appendRegistrationAnalytics('draft_restored', {
        restoredStep: typeof draftStep === 'number' ? draftStep : 0,
      });
    } catch (draftError) {
      console.debug('Draft restore skipped:', draftError);
    }
  }, [appendRegistrationAnalytics, totalSteps]);

  const scrollToError = (fieldName) => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (fieldName && formRef.current) {
        const fieldElement = formRef.current.querySelector(`[name="${fieldName}"]`);
        if (fieldElement) {
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          fieldElement.focus();
          return;
        }
      }

      if (bottomErrorRef.current) {
        bottomErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  };

  const getValidationErrors = () => {
    const errors = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'Please enter your first name';
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Please enter your last name';
    }

    if (!formData.gender) {
      errors.gender = 'Please select your gender';
    }

    if (!formData.dateOfBirth) {
      errors.dateOfBirth = 'Please enter your date of birth';
    } else {
      const birthDate = new Date(formData.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age -= 1;
      }

      if (age < 18) {
        errors.dateOfBirth = 'You must be at least 18 years old to register';
      }
    }

    if (!formData.email.trim()) {
      errors.email = 'Please enter your email address';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Please enter your phone number';
    } else if (formData.phone.trim().length < 7) {
      errors.phone = 'Phone number looks too short';
    }

    if (!formData.accountType) {
      errors.accountType = 'Please select your account type';
    }

    if (!formData.password) {
      errors.password = 'Please create a password';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    } else if (!/[A-Z]/.test(formData.password)) {
      errors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(formData.password)) {
      errors.password = 'Password must contain at least one lowercase letter';
    } else if (!/\d/.test(formData.password)) {
      errors.password = 'Password must contain at least one number';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.agreeTerms) {
      errors.agreeTerms = 'You must agree to the Terms of Service and Privacy Policy';
    }

    return errors;
  };

  const validationSnapshot = getValidationErrors();

  const stepCompletion = useMemo(() => {
    return WIZARD_STEPS.map((step) => {
      const completedCount = step.requiredFields.reduce((count, fieldName) => (
        validationSnapshot[fieldName] ? count : count + 1
      ), 0);

      return {
        id: step.id,
        completedCount,
        totalCount: step.requiredFields.length,
      };
    });
  }, [validationSnapshot]);

  const currentStepCompletion = stepCompletion[currentStep] || {
    completedCount: 0,
    totalCount: WIZARD_STEPS[currentStep]?.requiredFields.length || 0,
  };

  const validateStep = (stepIndex) => {
    const stepDefinition = WIZARD_STEPS.find((step) => step.id === stepIndex);
    if (!stepDefinition) {
      return true;
    }

    const allErrors = getValidationErrors();
    const stepErrors = stepDefinition.requiredFields.reduce((acc, fieldName) => {
      if (allErrors[fieldName]) {
        acc[fieldName] = allErrors[fieldName];
      }

      return acc;
    }, {});

    if (Object.keys(stepErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...stepErrors }));
      const firstInvalidField = stepDefinition.requiredFields.find((fieldName) => stepErrors[fieldName]);

      if (firstInvalidField) {
        const message = stepErrors[firstInvalidField];
        setLocalError(message);
        appendRegistrationAnalytics('field_validation_error', {
          field: firstInvalidField,
          message,
          step: stepIndex,
        });
        scrollToError(firstInvalidField);
      }

      return false;
    }

    setLocalError('');
    setFieldErrors((prev) => {
      const next = { ...prev };
      stepDefinition.requiredFields.forEach((fieldName) => {
        delete next[fieldName];
      });
      return next;
    });

    return true;
  };

  const validateForm = () => {
    const errors = getValidationErrors();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstInvalidField = VALIDATION_ORDER.find((fieldName) => errors[fieldName]) || Object.keys(errors)[0];

      setLocalError(errors[firstInvalidField]);
      appendRegistrationAnalytics('field_validation_error', {
        field: firstInvalidField,
        message: errors[firstInvalidField],
        step: currentStep,
      });
      scrollToError(firstInvalidField);
      return false;
    }

    return true;
  };

  const saveDraft = useCallback((source = 'manual') => {
    try {
      const draft = {
        formData: {
          ...formData,
          password: '',
          confirmPassword: '',
        },
        selectedCountryCode: selectedCountry.code,
        currentStep,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(REGISTRATION_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setLastDraftSavedAt(draft.savedAt);
      appendRegistrationAnalytics('draft_saved', { source });

      if (source === 'manual') {
        setStatusNotice({
          type: 'success',
          message: 'Draft saved on this device. You can continue later from this step.',
        });
      }
    } catch (draftError) {
      console.debug('Draft save skipped:', draftError);
    }
  }, [appendRegistrationAnalytics, currentStep, formData, selectedCountry.code]);

  useEffect(() => {
    if (completedRequiredFields === 0) {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveDraft('autosave');
    }, 1800);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [completedRequiredFields, currentStep, formData, saveDraft]);

  useEffect(() => {
    return () => {
      if (!registrationCompletedRef.current) {
        appendRegistrationAnalytics('registration_abandoned', {
          completedRequiredFields: completedRequiredFieldsRef.current,
          totalRequiredFields: completionChecks.length,
        });
      }

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [appendRegistrationAnalytics, completionChecks.length]);

  const clearDraft = () => {
    localStorage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
    setLastDraftSavedAt('');
  };

  const handleClearSavedDraft = () => {
    clearDraft();
    appendRegistrationAnalytics('draft_cleared', { source: 'manual' });
    setStatusNotice({
      type: 'info',
      message: 'Saved draft removed from this device.',
    });
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = name === 'phone' ? value.replace(/[^\d]/g, '') : value;

    if (name && !startedFieldsRef.current.has(name)) {
      startedFieldsRef.current.add(name);
      appendRegistrationAnalytics('field_started', { field: name });
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : nextValue,
    }));

    setFieldErrors((prev) => {
      if (!prev[name]) {
        return prev;
      }

      const next = { ...prev };
      delete next[name];
      return next;
    });

    setLocalError('');
    setStatusNotice((prev) => (prev.message ? { type: '', message: '' } : prev));
  };

  const handleNextStep = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    const nextStep = Math.min(currentStep + 1, totalSteps - 1);
    if (nextStep !== currentStep) {
      setCurrentStep(nextStep);
      appendRegistrationAnalytics('step_advanced', { fromStep: currentStep, toStep: nextStep });
      setStatusNotice({ type: '', message: '' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBackStep = () => {
    const previousStep = Math.max(currentStep - 1, 0);
    if (previousStep !== currentStep) {
      setCurrentStep(previousStep);
      appendRegistrationAnalytics('step_reversed', { fromStep: currentStep, toStep: previousStep });
      setStatusNotice({ type: '', message: '' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepClick = (stepIndex) => {
    if (stepIndex === currentStep) {
      return;
    }

    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
      appendRegistrationAnalytics('step_revisited', { fromStep: currentStep, toStep: stepIndex });
      return;
    }

    handleNextStep();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');

    if (!isLastStep) {
      handleNextStep();
      return;
    }

    if (!validateForm()) {
      return;
    }

    const fullPhoneNumber = `${selectedCountry.phoneCode}${formData.phone.replace(/^0+/, '')}`;

    try {
      appendRegistrationAnalytics('registration_submit_attempt', {
        accountType: formData.accountType,
      });

      const resultAction = await dispatch(registerUser({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: fullPhoneNumber,
        accountType: formData.accountType,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        faceVerificationConsent: formData.faceVerificationConsent,
        countryCode: selectedCountry.code,
      }));

      if (registerUser.fulfilled.match(resultAction)) {
        registrationCompletedRef.current = true;
        clearDraft();

        appendRegistrationAnalytics('registration_completed', {
          accountType: formData.accountType,
          totalProgress: formProgress,
        });

        const destination = resolvePostRegisterDestination();
        navigate(
          destination.pathname,
          destination.state !== undefined
            ? { replace: true, state: destination.state }
            : { replace: true }
        );
      } else {
        appendRegistrationAnalytics('registration_failed', {
          reason: resultAction.error?.message || 'Unknown registration error',
        });
        scrollToError();
      }
    } catch (submitError) {
      setLocalError('Registration failed. Please try again.');
      appendRegistrationAnalytics('registration_failed', {
        reason: submitError.message || 'Submit catch block triggered',
      });
      scrollToError();
    }
  };

  const WhyAskIcon = ({ title }) => (
    <Tooltip title={title} arrow placement="top">
      <IconButton
        size="small"
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          p: 0.25,
          ml: 0.5,
          '&:hover': {
            color: '#00f2ea',
          },
        }}
      >
        <InfoOutlined sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );

  const SectionHeader = ({ icon, title, subtitle, why }) => (
    <Box sx={{ mb: 2.5 }}>
      <Typography
        variant="h6"
        sx={{
          color: '#00f2ea',
          fontFamily: '"Outfit", sans-serif',
          fontWeight: 700,
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {icon}
        {title}
        {why ? <WhyAskIcon title={why} /> : null}
      </Typography>
      {subtitle ? (
        <Typography
          sx={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontFamily: '"Outfit", sans-serif',
            fontSize: '13px',
            mt: 0.5,
          }}
        >
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );

  const renderPersonalStep = () => (
    <Box>
      <SectionHeader
        icon={<Person sx={{ fontSize: 20 }} />}
        title="Step 1. Personal Information"
        subtitle="Tell us who you are so we can create your profile correctly."
      />

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <GlassInput
            name="firstName"
            label="First Name *"
            value={formData.firstName}
            onChange={handleChange}
            startIcon={<Person sx={{ color: '#00f2ea' }} />}
            placeholder="Enter first name"
            error={Boolean(fieldErrors.firstName)}
            helperText={fieldErrors.firstName || 'Use your real first name'}
            required
            autoComplete="given-name"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <GlassInput
            name="lastName"
            label="Last Name *"
            value={formData.lastName}
            onChange={handleChange}
            startIcon={<Person sx={{ color: '#00f2ea' }} />}
            placeholder="Enter last name"
            error={Boolean(fieldErrors.lastName)}
            helperText={fieldErrors.lastName || 'Use your real last name'}
            required
            autoComplete="family-name"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl
            error={Boolean(fieldErrors.gender)}
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(8px)',
                borderRadius: '16px',
                color: '#ffffff',
                '& fieldset': {
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(0, 242, 234, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#00f2ea',
                  borderWidth: '2px',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.6)',
                fontFamily: '"Outfit", sans-serif',
                '&.Mui-focused': {
                  color: '#00f2ea',
                },
              },
              '& .MuiSelect-icon': {
                color: 'rgba(255, 255, 255, 0.5)',
              },
            }}
          >
            <InputLabel>Gender *</InputLabel>
            <Select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              label="Gender *"
              startAdornment={<Wc sx={{ color: '#00f2ea', mr: 1 }} />}
            >
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
              <MenuItem value="non_binary">Non-Binary</MenuItem>
              <MenuItem value="prefer_not_to_say">Prefer not to say</MenuItem>
            </Select>
            <FormHelperText sx={{ color: fieldErrors.gender ? '#ff0055 !important' : 'rgba(255, 255, 255, 0.5)' }}>
              {fieldErrors.gender || 'Select the option you are most comfortable with'}
            </FormHelperText>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '14px',
                mb: 1,
                fontFamily: '"Outfit", sans-serif',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Date of Birth *
              <WhyAskIcon title="Why we ask: we verify legal age (18+) and apply age-safe platform protections." />
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(8px)',
                borderRadius: '16px',
                border: fieldErrors.dateOfBirth ? '1px solid rgba(255, 0, 85, 0.8)' : '1px solid rgba(255, 255, 255, 0.1)',
                height: '56px',
                px: 2,
                overflow: 'hidden',
                '&:hover': {
                  borderColor: 'rgba(0, 242, 234, 0.5)',
                },
                '&:focus-within': {
                  borderColor: '#00f2ea',
                  borderWidth: '2px',
                },
              }}
            >
              <Cake sx={{ color: '#00f2ea', mr: 1.5, flexShrink: 0 }} />
              <input
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleChange}
                autoComplete="bday"
                min="1940-01-01"
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '16px',
                  fontFamily: '"Outfit", sans-serif',
                  height: '100%',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  colorScheme: 'dark',
                }}
              />
            </Box>
            <Typography sx={{ color: fieldErrors.dateOfBirth ? '#ff0055' : 'rgba(255, 255, 255, 0.5)', fontSize: '12px', mt: 0.75, fontFamily: '"Outfit", sans-serif' }}>
              {fieldErrors.dateOfBirth || 'You must be 18 or older to join'}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );

  const renderContactStep = () => (
    <Box>
      <SectionHeader
        icon={<Email sx={{ fontSize: 20 }} />}
        title="Step 2. Contact Details"
        subtitle="We use these details for account security and important notifications."
      />

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <GlassInput
            name="email"
            type="email"
            label="Email Address *"
            value={formData.email}
            onChange={handleChange}
            startIcon={<Email sx={{ color: '#00f2ea' }} />}
            placeholder="Enter your email"
            error={Boolean(fieldErrors.email)}
            helperText={fieldErrors.email || 'Used for login, password reset, and account alerts'}
            required
            autoComplete="email"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '14px',
                mb: 1,
                fontFamily: '"Outfit", sans-serif',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Phone Number *
              <WhyAskIcon title="Why we ask: used for security verification, payment status alerts, and urgent booking confirmations." />
            </Typography>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(8px)',
                borderRadius: '16px',
                border: fieldErrors.phone ? '1px solid rgba(255, 0, 85, 0.8)' : '1px solid rgba(255, 255, 255, 0.1)',
                height: '56px',
                overflow: 'hidden',
                '&:hover': {
                  borderColor: 'rgba(0, 242, 234, 0.5)',
                },
                '&:focus-within': {
                  borderColor: '#00f2ea',
                  borderWidth: '2px',
                },
              }}
            >
              <Select
                value={selectedCountry.code}
                onChange={(event) => {
                  const country = AFRICAN_COUNTRIES.find((item) => item.code === event.target.value);
                  if (country) {
                    setSelectedCountry(country);
                    appendRegistrationAnalytics('country_code_changed', { selectedCountryCode: country.code });
                  }
                }}
                disabled={detectingLocation}
                sx={{
                  minWidth: 98,
                  height: '100%',
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& .MuiSelect-select': {
                    py: 0,
                    pl: 1.5,
                    pr: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.5)', right: 2 },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      background: '#1a1a1f',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      maxHeight: 300,
                      '& .MuiMenuItem-root': {
                        fontFamily: '"Outfit", sans-serif',
                        color: '#ffffff',
                        gap: 1,
                        '&:hover': { background: 'rgba(0, 242, 234, 0.1)' },
                        '&.Mui-selected': { background: 'rgba(0, 242, 234, 0.2)' },
                      },
                    },
                  },
                }}
                renderValue={(value) => {
                  const country = AFRICAN_COUNTRIES.find((item) => item.code === value);
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <span>{country?.flag}</span>
                      <span style={{ color: '#00f2ea', fontWeight: 600, fontSize: '14px' }}>{country?.phoneCode}</span>
                    </Box>
                  );
                }}
              >
                {AFRICAN_COUNTRIES.map((country) => (
                  <MenuItem key={country.code} value={country.code}>
                    <span>{country.flag}</span>
                    <span>{country.name}</span>
                    <span style={{ color: '#00f2ea', marginLeft: 'auto' }}>{country.phoneCode}</span>
                  </MenuItem>
                ))}
              </Select>

              <Box sx={{ width: '1px', height: '30px', bgcolor: 'rgba(255,255,255,0.15)' }} />

              <input
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                autoComplete="tel-national"
                placeholder="Enter phone number"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '16px',
                  padding: '0 12px',
                  fontFamily: '"Outfit", sans-serif',
                  WebkitBoxShadow: '0 0 0 1000px transparent inset',
                  WebkitTextFillColor: '#fff',
                }}
              />
            </Box>

            <Typography sx={{ color: fieldErrors.phone ? '#ff0055' : 'rgba(255, 255, 255, 0.5)', fontSize: '12px', mt: 0.75, fontFamily: '"Outfit", sans-serif' }}>
              {fieldErrors.phone || `Enter number without ${selectedCountry.phoneCode}; we add it automatically`}
            </Typography>

            {detectingLocation ? (
              <Typography sx={{ color: 'rgba(0, 242, 234, 0.7)', fontSize: '11px', mt: 0.5 }}>
                Detecting your location...
              </Typography>
            ) : null}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );

  const renderAccountStep = () => (
    <Box>
      <SectionHeader
        icon={<PersonAdd sx={{ fontSize: 20 }} />}
        title="Step 3. Account Setup"
        subtitle="Choose how you want to use Zerohook and secure your account."
      />

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <FormControl
            error={Boolean(fieldErrors.accountType)}
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(8px)',
                borderRadius: '16px',
                color: '#ffffff',
                '& fieldset': {
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(0, 242, 234, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#00f2ea',
                  borderWidth: '2px',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.6)',
                fontFamily: '"Outfit", sans-serif',
                '&.Mui-focused': {
                  color: '#00f2ea',
                },
              },
              '& .MuiSelect-icon': {
                color: 'rgba(255, 255, 255, 0.5)',
              },
            }}
          >
            <InputLabel>Account Type *</InputLabel>
            <Select
              name="accountType"
              value={formData.accountType}
              onChange={handleChange}
              label="Account Type *"
              displayEmpty
            >
              <MenuItem value="" disabled>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>Select account type</Typography>
              </MenuItem>

              <MenuItem value="client">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person sx={{ color: '#00f2ea', fontSize: 20 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>Clients</Typography>
                    <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Find hookup girls and boys</Typography>
                  </Box>
                </Box>
              </MenuItem>

              <MenuItem value="provider">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Star sx={{ color: '#ff0055', fontSize: 20 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>Providers</Typography>
                    <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Hookup girls and boys</Typography>
                  </Box>
                </Box>
              </MenuItem>

              <MenuItem value="sugar_daddy">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Diamond sx={{ color: '#FFD700', fontSize: 20 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 600, color: '#FFD700' }}>Sugar Daddy</Typography>
                    <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>I am a sugar daddy</Typography>
                  </Box>
                </Box>
              </MenuItem>

              <MenuItem value="sugar_mommy">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Diamond sx={{ color: '#FF69B4', fontSize: 20 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 600, color: '#FF69B4' }}>Sugar Mommy</Typography>
                    <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>I am a sugar mommy</Typography>
                  </Box>
                </Box>
              </MenuItem>
            </Select>
            <FormHelperText sx={{ color: fieldErrors.accountType ? '#ff0055 !important' : 'rgba(255, 255, 255, 0.5)' }}>
              {fieldErrors.accountType || 'Choose the role that describes how you will use Zerohook'}
            </FormHelperText>
          </FormControl>
        </Grid>

        <Collapse in={formData.accountType === 'sugar_daddy' || formData.accountType === 'sugar_mommy'} sx={{ width: '100%' }}>
          <Grid item xs={12}>
            <Alert
              severity="info"
              icon={<Diamond sx={{ color: '#FFD700' }} />}
              sx={{
                background: 'rgba(255, 215, 0, 0.1)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '12px',
                '& .MuiAlert-message': {
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontFamily: '"Outfit", sans-serif',
                },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#FFD700', mb: 0.5 }}>
                VVIP Account Benefits
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Your profile is private by default and only visible to eligible verified users.
              </Typography>
            </Alert>
          </Grid>
        </Collapse>

        <Grid item xs={12} sm={6}>
          <GlassInput
            name="password"
            label="Password *"
            type="password"
            value={formData.password}
            onChange={handleChange}
            startIcon={<Lock sx={{ color: '#00f2ea' }} />}
            placeholder="Min 8 chars, A-Z, a-z, 0-9"
            error={Boolean(fieldErrors.password)}
            helperText={fieldErrors.password || 'Use at least 8 characters with uppercase, lowercase, and a number'}
            required
            autoComplete="new-password"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <GlassInput
            name="confirmPassword"
            label="Confirm Password *"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            startIcon={<Lock sx={{ color: '#00f2ea' }} />}
            placeholder="Confirm password"
            error={Boolean(fieldErrors.confirmPassword)}
            helperText={fieldErrors.confirmPassword || 'Re-enter your password exactly'}
            required
            autoComplete="new-password"
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderTermsStep = () => (
    <Box>
      <SectionHeader
        icon={<VerifiedUser sx={{ fontSize: 20 }} />}
        title="Step 4. Verification & Terms"
        subtitle="Final confirmations before your account is created."
      />

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Box
            sx={{
              p: 2,
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
            }}
          >
            <Typography sx={{ color: '#00f2ea', fontFamily: '"Outfit", sans-serif', fontSize: '13px', fontWeight: 700, mb: 1 }}>
              Review before creating account
            </Typography>

            <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontFamily: '"Outfit", sans-serif', fontSize: '13px' }}>
              Name: {`${formData.firstName || '-'} ${formData.lastName || ''}`.trim() || '-'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontFamily: '"Outfit", sans-serif', fontSize: '13px' }}>
              Email: {formData.email || '-'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontFamily: '"Outfit", sans-serif', fontSize: '13px' }}>
              Phone: {formData.phone ? `${selectedCountry.phoneCode}${formData.phone.replace(/^0+/, '')}` : '-'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontFamily: '"Outfit", sans-serif', fontSize: '13px' }}>
              Account type: {ACCOUNT_TYPE_LABELS[formData.accountType] || 'Not selected'}
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.25 }}>
              <Typography
                role="button"
                onClick={() => handleStepClick(0)}
                sx={{ color: '#00f2ea', fontSize: '12px', fontFamily: '"Outfit", sans-serif', cursor: 'pointer' }}
              >
                Edit personal
              </Typography>
              <Typography
                role="button"
                onClick={() => handleStepClick(1)}
                sx={{ color: '#00f2ea', fontSize: '12px', fontFamily: '"Outfit", sans-serif', cursor: 'pointer' }}
              >
                Edit contact
              </Typography>
              <Typography
                role="button"
                onClick={() => handleStepClick(2)}
                sx={{ color: '#00f2ea', fontSize: '12px', fontFamily: '"Outfit", sans-serif', cursor: 'pointer' }}
              >
                Edit account setup
              </Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Box
            sx={{
              p: 2,
              borderRadius: '12px',
              background: 'rgba(0, 242, 234, 0.05)',
              border: '1px solid rgba(0, 242, 234, 0.2)',
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  name="faceVerificationConsent"
                  checked={formData.faceVerificationConsent}
                  onChange={handleChange}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    '&.Mui-checked': {
                      color: '#00f2ea',
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography
                    sx={{
                      color: '#ffffff',
                      fontFamily: '"Outfit", sans-serif',
                      fontSize: '14px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <VerifiedUser sx={{ color: '#00f2ea', fontSize: 18 }} />
                    I consent to face verification (optional)
                    <WhyAskIcon title="Why we ask: this helps increase trust and unlocks additional safety features. Optional for sign-up." />
                  </Typography>
                  <Typography
                    sx={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontFamily: '"Outfit", sans-serif',
                      fontSize: '12px',
                      mt: 0.5,
                    }}
                  >
                    Optional but recommended for faster trust building and verification badges.
                  </Typography>
                </Box>
              }
            />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Box
            sx={{
              border: fieldErrors.agreeTerms ? '1px solid rgba(255, 0, 85, 0.6)' : '1px solid transparent',
              borderRadius: '10px',
              px: 1,
              py: 0.5,
              background: fieldErrors.agreeTerms ? 'rgba(255, 0, 85, 0.08)' : 'transparent',
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    '&.Mui-checked': {
                      color: '#00f2ea',
                    },
                  }}
                />
              }
              label={
                <Typography
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontFamily: '"Outfit", sans-serif',
                    fontSize: '14px',
                  }}
                >
                  I agree to the{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      color: '#00f2ea',
                      textDecoration: 'none',
                    }}
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      color: '#00f2ea',
                      textDecoration: 'none',
                    }}
                  >
                    Privacy Policy
                  </a>
                </Typography>
              }
            />
            <Typography sx={{ color: fieldErrors.agreeTerms ? '#ff0055' : 'rgba(255, 255, 255, 0.5)', fontSize: '12px', mt: 0.25, ml: 5.5, fontFamily: '"Outfit", sans-serif' }}>
              {fieldErrors.agreeTerms || 'Required before creating your account'}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );

  const renderCurrentStep = () => {
    if (currentStep === 0) {
      return renderPersonalStep();
    }

    if (currentStep === 1) {
      return renderContactStep();
    }

    if (currentStep === 2) {
      return renderAccountStep();
    }

    return renderTermsStep();
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
      <GlassCard
        variant="default"
        hoverable={false}
        sx={{
          p: { xs: 2.25, sm: 4 },
          borderRadius: 4,
        }}
      >
        <Box textAlign="center" mb={3}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.2), rgba(255, 0, 85, 0.2))',
              border: '1px solid rgba(0, 242, 234, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <PersonAdd sx={{ fontSize: 40, color: '#00f2ea' }} />
          </Box>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              fontFamily: '"Outfit", sans-serif',
              background: 'linear-gradient(135deg, #00f2ea, #ff0055)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1,
            }}
          >
            Join Zerohook
          </Typography>

          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontFamily: '"Outfit", sans-serif',
            }}
          >
            Simple 4-step sign up on desktop and mobile
          </Typography>
        </Box>

        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: '12px',
            textAlign: 'left',
            background: 'rgba(0, 242, 234, 0.06)',
            border: '1px solid rgba(0, 242, 234, 0.2)',
          }}
        >
          <Typography sx={{ color: '#00f2ea', fontSize: '13px', fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>
            Progress: {formProgress}%
          </Typography>

          <LinearProgress
            variant="determinate"
            value={formProgress}
            sx={{
              mt: 1,
              height: 8,
              borderRadius: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: 'linear-gradient(90deg, #00f2ea, #ff0055)',
              },
            }}
          />

          {isMobile ? (
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '12px', mt: 1, fontFamily: '"Outfit", sans-serif' }}>
              Step {currentStep + 1} of {totalSteps}: {WIZARD_STEPS[currentStep].title}
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, mt: 1.25 }}>
              {WIZARD_STEPS.map((step, index) => {
                const active = index === currentStep;
                const complete = index < currentStep;
                const completion = stepCompletion[index] || { completedCount: 0, totalCount: step.requiredFields.length };
                const isComplete = completion.completedCount === completion.totalCount;

                return (
                  <Box
                    key={step.id}
                    onClick={() => handleStepClick(index)}
                    sx={{
                      cursor: index <= currentStep ? 'pointer' : 'default',
                      borderRadius: '10px',
                      border: active
                        ? '1px solid rgba(0, 242, 234, 0.6)'
                        : complete
                          ? '1px solid rgba(0, 242, 234, 0.3)'
                          : '1px solid rgba(255, 255, 255, 0.15)',
                      background: active
                        ? 'rgba(0, 242, 234, 0.14)'
                        : complete
                          ? 'rgba(0, 242, 234, 0.08)'
                          : 'rgba(255, 255, 255, 0.03)',
                      py: 1,
                      px: 0.8,
                      textAlign: 'center',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Typography sx={{ color: active ? '#00f2ea' : complete ? 'rgba(0, 242, 234, 0.9)' : 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>
                      {index + 1}
                    </Typography>
                    <Typography sx={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.75)', fontSize: '11px', fontFamily: '"Outfit", sans-serif' }}>
                      {step.shortLabel}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontFamily: '"Outfit", sans-serif' }}>
                      {completion.completedCount}/{completion.totalCount}
                    </Typography>
                    {isComplete ? (
                      <CheckCircleOutline sx={{ fontSize: 14, color: '#00f2ea', mt: 0.2 }} />
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          )}

          <Typography sx={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '12px', mt: 1, fontFamily: '"Outfit", sans-serif' }}>
            Current step completion: {currentStepCompletion.completedCount}/{currentStepCompletion.totalCount}. Fields marked * are required.
          </Typography>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', mt: 0.4, fontFamily: '"Outfit", sans-serif' }}>
            Sensitive fields include inline "Why we ask" tips. You can safely pause and continue later from this device.
          </Typography>
        </Box>

        {(authError || localError) ? (
          <Box
            ref={errorRef}
            sx={{
              mb: 2.5,
              p: 2,
              borderRadius: '12px',
              background: 'rgba(255, 0, 85, 0.1)',
              border: '1px solid rgba(255, 0, 85, 0.3)',
            }}
          >
            <Typography sx={{ color: '#ff0055', fontFamily: '"Outfit", sans-serif' }}>
              {authError || localError}
            </Typography>
          </Box>
        ) : null}

        {statusNotice.message ? (
          <Alert
            severity={statusNotice.type || 'info'}
            sx={{
              mb: 2.5,
              background: statusNotice.type === 'success' ? 'rgba(0, 242, 234, 0.12)' : 'rgba(0, 242, 234, 0.08)',
              color: '#ffffff',
              border: '1px solid rgba(0, 242, 234, 0.2)',
              '& .MuiAlert-icon': {
                color: statusNotice.type === 'success' ? '#00f2ea' : 'rgba(0, 242, 234, 0.9)',
              },
            }}
          >
            {statusNotice.message}
          </Alert>
        ) : null}

        {isAdminUser && !registrationDebugEnabled ? (
          <Alert
            severity="info"
            sx={{
              mb: 2.5,
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            Admin tip: add <strong>?registrationDebug=1</strong> to this page URL to open local registration drop-off stats.
          </Alert>
        ) : null}

        {showRegistrationDebugPanel ? (
          <Box
            sx={{
              mb: 2.5,
              p: 2,
              borderRadius: '12px',
              background: 'rgba(255, 196, 0, 0.08)',
              border: '1px solid rgba(255, 196, 0, 0.35)',
            }}
          >
            <Typography
              sx={{
                color: '#ffd24d',
                fontFamily: '"Outfit", sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              <AdminPanelSettings sx={{ fontSize: 18 }} />
              Admin Registration Debug (Local Browser)
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', fontFamily: '"Outfit", sans-serif', mt: 0.5 }}>
              Event records: {registrationDebugStats.eventCount} {registrationDebugStats.lastUpdated ? `| Last update: ${summarizeDraftTimestamp(registrationDebugStats.lastUpdated)}` : ''}
            </Typography>

            <Grid container spacing={1.5} sx={{ mt: 0.8 }}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 1.25, borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}>
                  <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '12px', fontFamily: '"Outfit", sans-serif', mb: 0.4 }}>
                    Desktop
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px', fontFamily: '"Outfit", sans-serif' }}>
                    Sessions viewed: {registrationDebugStats.desktopSummary.stepViews} | Submit attempts: {registrationDebugStats.desktopSummary.submitAttempts}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px', fontFamily: '"Outfit", sans-serif', mb: 0.75 }}>
                    Completed: {registrationDebugStats.desktopSummary.completed} | Abandoned: {registrationDebugStats.desktopSummary.abandoned}
                  </Typography>
                  {registrationDebugStats.desktopTopFields.length > 0 ? registrationDebugStats.desktopTopFields.map((item, index) => (
                    <Typography key={`desktop-${item.field}`} sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '11px', fontFamily: '"Outfit", sans-serif' }}>
                      {index + 1}. {item.label}: {item.count}
                    </Typography>
                  )) : (
                    <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', fontFamily: '"Outfit", sans-serif' }}>
                      No desktop validation failures tracked yet.
                    </Typography>
                  )}
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 1.25, borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}>
                  <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '12px', fontFamily: '"Outfit", sans-serif', mb: 0.4 }}>
                    Mobile
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px', fontFamily: '"Outfit", sans-serif' }}>
                    Sessions viewed: {registrationDebugStats.mobileSummary.stepViews} | Submit attempts: {registrationDebugStats.mobileSummary.submitAttempts}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px', fontFamily: '"Outfit", sans-serif', mb: 0.75 }}>
                    Completed: {registrationDebugStats.mobileSummary.completed} | Abandoned: {registrationDebugStats.mobileSummary.abandoned}
                  </Typography>
                  {registrationDebugStats.mobileTopFields.length > 0 ? registrationDebugStats.mobileTopFields.map((item, index) => (
                    <Typography key={`mobile-${item.field}`} sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '11px', fontFamily: '"Outfit", sans-serif' }}>
                      {index + 1}. {item.label}: {item.count}
                    </Typography>
                  )) : (
                    <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', fontFamily: '"Outfit", sans-serif' }}>
                      No mobile validation failures tracked yet.
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>

            <Box
              sx={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: 1,
                mt: 1.2,
              }}
            >
              <GlassButton
                type="button"
                variant="outlined"
                onClick={loadRegistrationDebugStats}
                startIcon={<Refresh sx={{ fontSize: 17 }} />}
                fullWidth={isMobile}
              >
                Refresh Stats
              </GlassButton>
              <GlassButton
                type="button"
                variant="glass"
                onClick={clearRegistrationDebugStats}
                startIcon={<DeleteOutline sx={{ fontSize: 17 }} />}
                fullWidth={isMobile}
              >
                Clear Local Analytics
              </GlassButton>
            </Box>
          </Box>
        ) : null}

        <Box component="form" onSubmit={handleSubmit} ref={formRef} noValidate>
          {renderCurrentStep()}

          {(authError || localError) ? (
            <Box
              ref={bottomErrorRef}
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: '12px',
                background: 'rgba(255, 0, 85, 0.1)',
                border: '1px solid rgba(255, 0, 85, 0.3)',
              }}
            >
              <Typography sx={{ color: '#ff0055', fontFamily: '"Outfit", sans-serif', fontSize: '14px', textAlign: 'center' }}>
                {authError || localError}
              </Typography>
            </Box>
          ) : null}

          <Box
            sx={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 1.2,
              mt: 3,
            }}
          >
            <GlassButton
              type="button"
              variant="glass"
              onClick={() => saveDraft('manual')}
              startIcon={<SaveOutlined sx={{ fontSize: 18 }} />}
              fullWidth={isMobile}
              sx={{ minWidth: isMobile ? '100%' : 190 }}
            >
              Save and Continue Later
            </GlassButton>

            {lastDraftSavedAt ? (
              <GlassButton
                type="button"
                variant="outlined"
                onClick={handleClearSavedDraft}
                startIcon={<RestartAlt sx={{ fontSize: 18 }} />}
                fullWidth={isMobile}
                sx={{ minWidth: isMobile ? '100%' : 170 }}
              >
                Clear Saved Draft
              </GlassButton>
            ) : null}

            {!isLastStep ? (
              <GlassButton
                type="button"
                variant="primary"
                onClick={handleNextStep}
                endIcon={<ArrowForward sx={{ fontSize: 18 }} />}
                fullWidth
              >
                Continue to {WIZARD_STEPS[currentStep + 1].shortLabel}
              </GlassButton>
            ) : (
              <GlassButton
                type="submit"
                variant="primary"
                loading={loading}
                glowing
                fullWidth
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </GlassButton>
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 1.4,
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <GlassButton
              type="button"
              variant="outlined"
              onClick={handleBackStep}
              startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
              disabled={currentStep === 0}
              sx={{ minWidth: 120 }}
            >
              Back
            </GlassButton>

            <Typography sx={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '12px', fontFamily: '"Outfit", sans-serif' }}>
              Step {currentStep + 1} of {totalSteps}
            </Typography>

            <Typography sx={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '12px', fontFamily: '"Outfit", sans-serif' }}>
              {lastDraftSavedAt ? `Draft saved ${summarizeDraftTimestamp(lastDraftSavedAt)}` : 'Draft auto-saves as you type'}
            </Typography>
          </Box>

          <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontFamily: '"Outfit", sans-serif',
                px: 2,
              }}
            >
              or
            </Typography>
          </Divider>

          <Box textAlign="center">
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontFamily: '"Outfit", sans-serif',
              }}
            >
              Already have an account?{' '}
              <Link
                to="/login"
                style={{
                  color: '#00f2ea',
                  textDecoration: 'none',
                  fontWeight: 700,
                }}
              >
                Sign In
              </Link>
            </Typography>
          </Box>
        </Box>
      </GlassCard>
    </Container>
  );
};

export default RegisterPage;

