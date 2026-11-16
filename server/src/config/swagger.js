const dateTime = {
  type: 'string',
  format: 'date-time',
  pattern: String.raw`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`,
  example: '2026-01-15T10:30:00.000Z',
};

const errorResponse = {
  description: 'Error response',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
};

const APPLICATION_LABEL = '#/components/schemas/Application';
const CONTACT_LABEL = '#/components/schemas/Contact';

const jsonResponse = (description, schema) => ({
  description,
  content: {
    'application/json': { schema },
  },
});

const recordId = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Numeric ID of the record',
  schema: {
    type: 'string',
    example: '1',
  },
};

const applicationProperties = {
  company: { type: 'string', example: 'OpenAI' },
  position: { type: 'string', example: 'Software Engineer' },
  city: { type: 'string', example: 'London' },
  country: { type: 'string', example: 'United Kingdom' },
  type: {
    type: 'string',
    enum: ['industry', 'research'],
    example: 'industry',
  },
  notes: { type: 'string', example: 'Follow up next week' },
  appliedAt: dateTime,
  durationType: {
    type: 'string',
    enum: ['', 'fixed', 'indefinite'],
    example: 'fixed',
  },
  durationMonths: {
    type: ['integer', 'null'],
    minimum: 1,
    nullable: true,
    example: 12,
  },
  status: {
    type: 'string',
    enum: ['pending', 'interview', 'offer', 'rejected'],
    default: 'pending',
    example: 'pending',
  },
};

const contactProperties = {
  contact: { type: 'string', example: 'Jane Smith' },
  email: { type: 'string', example: 'jane@example.com' },
  institution: { type: 'string', example: 'Example University' },
  department: { type: 'string', example: 'Computer Science' },
  city: { type: 'string', example: 'Madrid' },
  country: { type: 'string', example: 'Spain' },
  notes: { type: 'string', example: 'Met at a conference' },
  contactedAt: dateTime,
  status: {
    type: 'string',
    enum: ['pending', 'replied', 'rejected'],
    default: 'pending',
    example: 'pending',
  },
};

const applicationInput = {
  type: 'object',
  additionalProperties: false,
  required: ['company', 'position', 'type', 'country', 'appliedAt'],
  properties: applicationProperties,
};

const applicationPatch = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: applicationProperties,
};

const contactInput = {
  type: 'object',
  additionalProperties: false,
  required: ['contact', 'email', 'institution', 'country', 'contactedAt'],
  properties: contactProperties,
};

const contactPatch = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: contactProperties,
};

const historyEvent = {
  type: 'object',
  properties: {
    oldValue: { type: ['string', 'null'] },
    newValue: { type: 'string' },
    field: { type: 'string', enum: ['status', 'notes'] },
    changedAt: dateTime,
  },
  additionalProperties: true,
};

const application = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    ...applicationProperties,
    status: {
      ...applicationProperties.status,
      enum: [...applicationProperties.status.enum, 'suspended'],
    },
    updatedAt: dateTime,
    history: {
      type: 'array',
      items: historyEvent,
    },
  },
  additionalProperties: true,
};

const contact = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    ...contactProperties,
    status: {
      ...contactProperties.status,
      enum: [...contactProperties.status.enum, 'suspended'],
    },
    updatedAt: dateTime,
    history: {
      type: 'array',
      items: historyEvent,
    },
  },
  additionalProperties: true,
};

const applicationList = {
  type: 'object',
  required: ['applications'],
  properties: {
    applications: {
      type: 'array',
      items: { $ref: APPLICATION_LABEL },
    },
  },
};

const contactList = {
  type: 'object',
  required: ['contacts'],
  properties: {
    contacts: {
      type: 'array',
      items: { $ref: CONTACT_LABEL },
    },
  },
};

const idParameter = () => ({ ...recordId });

const applicationPath = '/api/applications';
const contactPath = '/api/contacts';

const spec = {
  openapi: '3.1.0',

  info: {
    title: 'Job Tracker API',
    version: '1.0.7',
    description: 'REST API for managing job applications and professional contacts.',
  },

  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local development server',
    },
  ],

  tags: [
    { name: 'Applications', description: 'Job application management' },
    { name: 'Contacts', description: 'Professional contact management' },
  ],

  paths: {
    [applicationPath]: {
      get: {
        tags: ['Applications'],
        summary: 'List applications',
        operationId: 'listApplications',
        responses: {
          200: jsonResponse('Applications retrieved', {
            $ref: '#/components/schemas/ApplicationList',
          }),
          403: errorResponse,
          500: errorResponse,
        },
      },

      post: {
        tags: ['Applications'],
        summary: 'Create application',
        operationId: 'createApplication',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApplicationInput' },
            },
          },
        },
        responses: {
          201: jsonResponse('Application created', {
            $ref: APPLICATION_LABEL,
          }),
          400: errorResponse,
          403: errorResponse,
          413: errorResponse,
          500: errorResponse,
        },
      },
    },

    [`${applicationPath}/old`]: {
      get: {
        tags: ['Applications'],
        summary: 'List old applications',
        description: 'Returns pending applications older than 30 days.',
        operationId: 'listOldApplications',
        responses: {
          200: jsonResponse('Old applications retrieved', {
            $ref: '#/components/schemas/ApplicationList',
          }),
          403: errorResponse,
          500: errorResponse,
        },
      },
    },

    [`${applicationPath}/{id}`]: {
      patch: {
        tags: ['Applications'],
        summary: 'Update application',
        operationId: 'updateApplication',
        parameters: [idParameter()],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApplicationPatch' },
            },
          },
        },
        responses: {
          200: jsonResponse('Application updated', {
            $ref: APPLICATION_LABEL,
          }),
          400: errorResponse,
          403: errorResponse,
          413: errorResponse,
          404: errorResponse,
          500: errorResponse,
        },
      },

      delete: {
        tags: ['Applications'],
        summary: 'Delete application',
        operationId: 'deleteApplication',
        parameters: [idParameter()],
        responses: {
          204: { description: 'Application deleted' },
          403: errorResponse,
          404: errorResponse,
          500: errorResponse,
        },
      },
    },

    [`${applicationPath}/{id}/suspend`]: {
      patch: {
        tags: ['Applications'],
        summary: 'Suspend stale application',
        description: 'Suspends an application only if it is pending and older than 30 days.',
        operationId: 'suspendApplication',
        parameters: [idParameter()],
        responses: {
          200: jsonResponse('Application suspended', {
            $ref: APPLICATION_LABEL,
          }),
          400: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
          500: errorResponse,
        },
      },
    },

    [contactPath]: {
      get: {
        tags: ['Contacts'],
        summary: 'List contacts',
        operationId: 'listContacts',
        responses: {
          200: jsonResponse('Contacts retrieved', {
            $ref: '#/components/schemas/ContactList',
          }),
          403: errorResponse,
          500: errorResponse,
        },
      },

      post: {
        tags: ['Contacts'],
        summary: 'Create contact',
        operationId: 'createContact',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContactInput' },
            },
          },
        },
        responses: {
          201: jsonResponse('Contact created', {
            $ref: CONTACT_LABEL,
          }),
          400: errorResponse,
          403: errorResponse,
          413: errorResponse,
          500: errorResponse,
        },
      },
    },

    [`${contactPath}/old`]: {
      get: {
        tags: ['Contacts'],
        summary: 'List old contacts',
        description: 'Returns pending contacts older than 30 days.',
        operationId: 'listOldContacts',
        responses: {
          200: jsonResponse('Old contacts retrieved', {
            $ref: '#/components/schemas/ContactList',
          }),
          403: errorResponse,
          500: errorResponse,
        },
      },
    },

    [`${contactPath}/{id}`]: {
      patch: {
        tags: ['Contacts'],
        summary: 'Update contact',
        operationId: 'updateContact',
        parameters: [idParameter()],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContactPatch' },
            },
          },
        },
        responses: {
          200: jsonResponse('Contact updated', {
            $ref: CONTACT_LABEL,
          }),
          400: errorResponse,
          403: errorResponse,
          413: errorResponse,
          404: errorResponse,
          500: errorResponse,
        },
      },

      delete: {
        tags: ['Contacts'],
        summary: 'Delete contact',
        operationId: 'deleteContact',
        parameters: [idParameter()],
        responses: {
          204: { description: 'Contact deleted' },
          403: errorResponse,
          404: errorResponse,
          500: errorResponse,
        },
      },
    },

    [`${contactPath}/{id}/suspend`]: {
      patch: {
        tags: ['Contacts'],
        summary: 'Suspend stale contact',
        description: 'Suspends a contact only if it is pending and older than 30 days.',
        operationId: 'suspendContact',
        parameters: [idParameter()],
        responses: {
          200: jsonResponse('Contact suspended', {
            $ref: CONTACT_LABEL,
          }),
          400: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
          500: errorResponse,
        },
      },
    },
  },

  components: {
    schemas: {
      Application: application,
      Contact: contact,
      ApplicationInput: applicationInput,
      ApplicationPatch: applicationPatch,
      ContactInput: contactInput,
      ContactPatch: contactPatch,
      ApplicationList: applicationList,
      ContactList: contactList,

      Error: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', example: 'Invalid application data' },
          description: {
            type: 'string',
            example: 'One or more fields contain invalid values.',
          },
          details: {
            type: 'array',
            items: {
              type: 'object',
              required: ['field', 'code', 'message'],
              properties: {
                field: { type: 'string', example: 'company' },
                code: {
                  type: 'string',
                  example: 'REQUIRED_FIELD',
                },
                message: {
                  type: 'string',
                  example: 'Company is required',
                },
              },
            },
          },
        },
      },
    },
  },
};

module.exports = spec;
