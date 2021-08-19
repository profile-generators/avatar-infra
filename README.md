# avatar-infra
AWS Infrastructure and server for avatar generation

# AWS Resources

Static files (parts, frontend and permanent avatars) are stored in a S3 bucket.

A cloudfront distribution is in front of the S3 bucket and is the target of the root domain https://avatr.cc

A Lambda@edge function is responsible for server-side processing of permanent avatars requests. It renders png images from svg parts and uploads them to the static S3 bucket for delivery.

## Resource List

- S3 private bucket, with a policy to allow cloudfront to access it
- A cloudfront origin access identity to access the bucket
- A cloudfront origin request policy and cache policy configured to cache and compress as much as possible
- A cloudfront distribution providing the main website
- A Route53 HostedZone with aliases in ipv4 and ipv6 to the cloudfront distribution
- A CMK asymmetric ECC_NIST_P256 key for DNSSEC
- A KSK derived from the CMK for DNSSEC
- An ACM ssl certificate for the domain name

The whole AWS infrastructure is described as a cloudformation stack in [infra.json](infra.json)

## Deployment

### Preparation

You should create an IAM user with appropriate access to the resources needed by the stack.

You need a domain registered in Route53 (make sure to delete the hosted zone if it exists already, it will be created by the stack)

### Deploy

We recommend to create the stack with the AWS console and using a change set. This will allow you to preview changes before deploying the stack.

You can use the following guide to do so:
https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-create-stacks-changesets.html
