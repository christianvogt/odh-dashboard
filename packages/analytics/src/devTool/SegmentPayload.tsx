import * as React from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  CodeBlock,
  CodeBlockCode,
  Content,
  EmptyState,
  EmptyStateBody,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import { prettyJson } from './utils';
import type { RawEvent } from '../controller/types';

type SegmentPayloadProps = {
  event: RawEvent | null;
};

export const SegmentPayload: React.FC<SegmentPayloadProps> = ({ event }) => {
  if (!event) {
    return (
      <EmptyState headingLevel="h4" icon={CubesIcon} titleText="No event selected">
        <EmptyStateBody>Select an event from the sidebar to view its payload.</EmptyStateBody>
      </EmptyState>
    );
  }

  const payloads = event.analyticsPayloads ?? [];

  if (payloads.length === 0) {
    return (
      <Card isCompact>
        <CardTitle>Segment Payload</CardTitle>
        <CardBody>
          <Content component="small">No analytics payloads were emitted for this event.</Content>
        </CardBody>
      </Card>
    );
  }

  return (
    <Stack hasGutter>
      {payloads.map((payload) => (
        <StackItem key={`${payload.source}-${payload.id}`}>
          <Card isCompact>
            <CardTitle>Event name: {payload.eventName}</CardTitle>
            <CardBody>
              <CodeBlock>
                <CodeBlockCode>{prettyJson(payload.payload)}</CodeBlockCode>
              </CodeBlock>
            </CardBody>
          </Card>
        </StackItem>
      ))}
    </Stack>
  );
};
