#include <stdint.h>
#include <stddef.h>
#include <jxl/decode.h>
int reconstruct(const uint8_t* input,size_t len,uint8_t* output,size_t capacity){
 if(!input||!output||!len||!capacity||capacity>134217728)return -1;
 JxlDecoder* d=JxlDecoderCreate(NULL);if(!d)return -2;
 int result=-3,seen=0;
 if(JxlDecoderSubscribeEvents(d,JXL_DEC_JPEG_RECONSTRUCTION|JXL_DEC_FULL_IMAGE)!=JXL_DEC_SUCCESS)goto done;
 if(JxlDecoderSetInput(d,input,len)!=JXL_DEC_SUCCESS)goto done;
 JxlDecoderCloseInput(d);
 for(int i=0;i<16;i++){
  JxlDecoderStatus s=JxlDecoderProcessInput(d);
  if(s==JXL_DEC_JPEG_RECONSTRUCTION){if(seen++)goto done;if(JxlDecoderSetJPEGBuffer(d,output,capacity)!=JXL_DEC_SUCCESS)goto done;}
  else if(s==JXL_DEC_SUCCESS){if(seen){size_t left=JxlDecoderReleaseJPEGBuffer(d);if(JxlDecoderReleaseInput(d)==0)result=(int)(capacity-left);}break;}
  else if(s==JXL_DEC_FULL_IMAGE)continue;
  else { result=-100-(int)s;break; }
 }
 done:JxlDecoderDestroy(d);return result;
}
