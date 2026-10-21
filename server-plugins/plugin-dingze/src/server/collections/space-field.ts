// Multi-space field (plugin-multi-space): records follow the request's `x-spaces` space.
export const spaceField = {
  type: 'belongsTo',
  name: 'space',
  interface: 'space',
  target: 'spaces',
  foreignKey: 'spaceName',
  targetKey: 'name',
  uiSchema: {
    type: 'object',
    title: '{{t("Space")}}',
    'x-component': 'AssociationField',
    'x-component-props': { multiple: false },
  },
} as const;
