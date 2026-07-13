import React from 'react';
import EditorPlaceholder from "../../../../../../EditorPlaceholder";

const EditorWrapper = ({
  user,
  currentTemplateId,
  contentData,
  setContentData,
  onAutoSaveRequested,
  documentTitle
}) => {
  return (
    <div style={{ padding: '0 8px 8px 8px' }}>
      <EditorPlaceholder
        mode="create"
        user={user}
        templateId={currentTemplateId}
        documentTitle={documentTitle}
      />
    </div>
  );
};

export default EditorWrapper;
